import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

async function sendPushNotification(subscription: PushSubscription, payload: any) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

  const encoder = new TextEncoder()
  
  // VAPID header generation (simplified - in production use a proper web-push library)
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`

  const header = {
    alg: 'ES256',
    typ: 'JWT',
  }

  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: 'mailto:admin@toothpoint.app',
  }

  // Note: In production, use a proper web-push library for Deno
  // This is a simplified version for demonstration
  
  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        // VAPID Authorization header would go here
      },
      body: JSON.stringify(payload),
    })
    
    if (response.status === 410 || response.status === 404) {
      return 'expired'
    }
    return response.ok
  } catch (error) {
    console.error('Push error:', error)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000)

    // Find appointments needing 24h reminders
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
      .lt('slots.start_time', new Date(in24Hours.getTime() + 60 * 60 * 1000).toISOString())

    if (error24h) {
      console.error('Error fetching 24h appointments:', error24h)
    }

    // Find appointments needing 1h reminders
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
      .lt('slots.start_time', new Date(in1Hour.getTime() + 60 * 60 * 1000).toISOString())

    if (error1h) {
      console.error('Error fetching 1h appointments:', error1h)
    }

    let sent24h = 0
    let sent1h = 0

    // Send 24h reminders
    for (const appointment of appointments24h || []) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', appointment.patient_id)

      for (const sub of subscriptions || []) {
        const result = await sendPushNotification(sub, {
          title: 'Appointment Reminder',
          body: `Your appointment with Dr. ${appointment.dentist?.full_name} is in 24 hours at ${new Date(appointment.slot?.start_time).toLocaleTimeString()}`,
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

    // Send 1h reminders
    for (const appointment of appointments1h || []) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', appointment.patient_id)

      for (const sub of subscriptions || []) {
        const result = await sendPushNotification(sub, {
          title: 'Appointment Starting Soon',
          body: `Your appointment with Dr. ${appointment.dentist?.full_name} starts in 1 hour at ${new Date(appointment.slot?.start_time).toLocaleTimeString()}`,
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

    return new Response(JSON.stringify({
      success: true,
      reminders_sent: {
        '24h': sent24h,
        '1h': sent1h,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Reminder function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})