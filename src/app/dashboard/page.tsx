import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle, Plus, ArrowRight } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const isDentist = profile.role === 'dentist'

  if (isDentist) {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(full_name, phone),
        slot:slots(start_time, end_time)
      `)
      .eq('dentist_id', profile.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(10)

    const { count: pendingCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('dentist_id', profile.id)
      .eq('status', 'pending')

    const { count: todayAppointments } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('dentist_id', profile.id)
      .eq('status', 'approved')
      .gte('slots.start_time', new Date().toISOString().split('T')[0])
      .lt('slots.start_time', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, Dr. {profile?.full_name?.split(' ').pop() || ''}</h1>
          <p className="text-gray-600 mt-1">Here's what's happening with your practice today</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Pending Requests"
            value={pendingCount || 0}
            icon={AlertCircle}
            color="text-yellow-600 bg-yellow-100"
            href="/bookings"
          />
          <StatCard
            title="Today's Appointments"
            value={todayAppointments || 0}
            icon={Calendar}
            color="text-blue-600 bg-blue-100"
            href="/calendar"
          />
          <StatCard
            title="Manage Availability"
            value="Set Schedule"
            icon={Clock}
            color="text-green-600 bg-green-100"
            href="/availability"
          />
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Booking Requests</h2>
            <Link href="/bookings" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="card-body p-0">
            {appointments && appointments.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {appointments.map((appointment) => (
                  <AppointmentRow key={appointment.id} appointment={appointment} isDentist={true} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No booking requests yet</h3>
                <p className="text-gray-500 mt-1">When patients book appointments, they'll appear here</p>
                <Link href="/availability" className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="h-4 w-4" />
                  Set up your availability
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  } else {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        *,
        dentist:profiles!appointments_dentist_id_fkey(full_name),
        slot:slots(start_time, end_time)
      `)
      .eq('patient_id', profile.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(10)

    const { count: upcomingCount } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', profile.id)
      .eq('status', 'approved')
      .gte('slots.start_time', new Date().toISOString())

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {profile?.full_name?.split(' ')[0] || ''}</h1>
          <p className="text-gray-600 mt-1">Manage your dental appointments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Upcoming Appointments"
            value={upcomingCount || 0}
            icon={Calendar}
            color="text-blue-600 bg-blue-100"
            href="/calendar"
          />
          <StatCard
            title="Find a Dentist"
            value="Browse"
            icon={Users}
            color="text-green-600 bg-green-100"
            href="/dentists"
          />
          <StatCard
            title="Booking History"
            value="View All"
            icon={Clock}
            color="text-purple-600 bg-purple-100"
            href="/calendar"
          />
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your Appointments</h2>
            <Link href="/calendar" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="card-body p-0">
            {appointments && appointments.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {appointments.map((appointment) => (
                  <AppointmentRow key={appointment.id} appointment={appointment} isDentist={false} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No appointments yet</h3>
                <p className="text-gray-500 mt-1">Book your first appointment with a dentist</p>
                <Link href="/dentists" className="mt-4 inline-flex items-center gap-2 btn-primary">
                  <Plus className="h-4 w-4" />
                  Find a Dentist
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
}

function StatCard({ title, value, icon: Icon, color, href }: { title: string; value: number | string; icon: React.ComponentType<{ className?: string }>; color: string; href: string }) {
  return (
    <Link href={href} className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={cn('p-3 rounded-xl', color)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Link>
  )
}

function AppointmentRow({ appointment, isDentist }: { appointment: any; isDentist: boolean }) {
  const statusColors = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    cancelled: 'badge-cancelled',
    completed: 'badge-completed',
  }

  const otherParty = isDentist ? appointment.patient : appointment.dentist
  const slot = appointment.slot

  return (
    <Link
      href={isDentist ? `/bookings/${appointment.id}` : `/appointments/${appointment.id}`}
      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
          {otherParty?.full_name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-gray-900">{otherParty?.full_name || 'Unknown'}</p>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            {slot && formatDateTime(slot.start_time)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn('badge', statusColors[appointment.status as keyof typeof statusColors] || 'badge-pending')}>
          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
        </span>
        {isDentist && appointment.status === 'pending' && (
          <span className="text-sm text-blue-600 font-medium">Action needed</span>
        )}
      </div>
    </Link>
  )
}