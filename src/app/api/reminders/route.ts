import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

interface AppointmentWithRelations {
  id: string
  patient_id: string
  dentist: { full_name: string } | null
  slot: { start_time: string; end_time: string } | null
}

function configureWebPush() {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:admin@toothpoint.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
  }
}

async function sendPushNotification(subscription: PushSubscription, payload: any) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    )
    return true
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      return 'expired'
    }
    console.error('Push notification error:', error)
    return false
  }
}

async function logNotification(
  supabase: any,
  userId: string,
  type: string,
  title: string,
  body: string,
  data: any,
  sent: boolean,
  error?: string
) {
  await supabase.from('notification_logs').insert({
    user_id: userId,
    type,
    title,
    body,
    data,
    sent,
    sent_at: sent ? new Date().toISOString() : null,
    error,
  })
}

export async function GET(request: Request) {
  try {
    configureWebPush()
    
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const now = new Date()
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000)

    const { data: appointments24h, error: error24h } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist:profiles!appointments_dentist_id_fkey(full_name),
        slot:slots(start_time, end_time)
      `)
      .eq('status', 'approved')
      .gte('slots.start_time', in24Hours.toISOString())
      .lt('slots.start_time', new Date(in24Hours.getTime() + 60 * 60 * 1000).toISOString()) as { data: AppointmentWithRelations[] | null; error: any }

    if (error24h) {
      console.error('Error fetching 24h appointments:', error24h)
    }

    const { data: appointments1h, error: error1h } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist:profiles!appointments_dentist_id_fkey(full_name),
        slot:slots(start_time, end_time)
      `)
      .eq('status', 'approved')
      .gte('slots.start_time', in1Hour.toISOString())
      .lt('slots.start_time', new Date(in1Hour.getTime() + 60 * 60 * 1000).toISOString()) as { data: AppointmentWithRelations[] | null; error: any }

    if (error1h) {
      console.error('Error fetching 1h appointments:', error1h)
    }

    let sent24h = 0
    let sent1h = 0

    for (const appointment of appointments24h || []) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', appointment.patient_id)

      for (const sub of subscriptions || []) {
        const result = await sendPushNotification(sub, {
          title: 'Appointment Reminder',
          body: `Your appointment with Dr. ${appointment.dentist?.full_name} is in 24 hours at ${appointment.slot ? new Date(appointment.slot.start_time).toLocaleTimeString() : 'TBD'}`,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          data: {
            type: 'reminder_24h',
            appointmentId: appointment.id,
            url: `/appointments/${appointment.id}`,
          },
          actions: [
            { action: 'view', title: 'View Details' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        })

        if (result === true) {
          await logNotification(supabase, appointment.patient_id, 'reminder_24h', 'Appointment Reminder', `Your appointment with Dr. ${appointment.dentist?.full_name} is in 24 hours`, { appointmentId: appointment.id }, true)
          sent24h++
        } else if (result === 'expired') {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          await logNotification(supabase, appointment.patient_id, 'reminder_24h', 'Appointment Reminder', `Your appointment with Dr. ${appointment.dentist?.full_name} is in 24 hours`, { appointmentId: appointment.id }, false, 'Push failed')
        }
      }
    }

    for (const appointment of appointments1h || []) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', appointment.patient_id)

      for (const sub of subscriptions || []) {
        const result = await sendPushNotification(sub, {
          title: 'Appointment Starting Soon',
          body: `Your appointment with Dr. ${appointment.dentist?.full_name} starts in 1 hour at ${appointment.slot ? new Date(appointment.slot.start_time).toLocaleTimeString() : 'TBD'}`,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          data: {
            type: 'reminder_1h',
            appointmentId: appointment.id,
            url: `/appointments/${appointment.id}`,
          },
          actions: [
            { action: 'view', title: 'View Details' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        })

        if (result === true) {
          await logNotification(supabase, appointment.patient_id, 'reminder_1h', 'Appointment Starting Soon', `Your appointment with Dr. ${appointment.dentist?.full_name} starts in 1 hour`, { appointmentId: appointment.id }, true)
          sent1h++
        } else if (result === 'expired') {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          await logNotification(supabase, appointment.patient_id, 'reminder_1h', 'Appointment Starting Soon', `Your appointment with Dr. ${appointment.dentist?.full_name} starts in 1 hour`, { appointmentId: appointment.id }, false, 'Push failed')
        }
      }
    }

    return NextResponse.json({
      success: true,
      reminders_sent: {
        '24h': sent24h,
        '1h': sent1h,
      },
    })
  } catch (error: any) {
    console.error('Reminder cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}