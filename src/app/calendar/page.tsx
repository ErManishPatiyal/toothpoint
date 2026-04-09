'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Calendar as BigCalendar, momentLocalizer, View } from 'react-big-calendar'
import { useRouter } from 'next/navigation'
import moment from 'moment'
import { Plus, ChevronLeft, ChevronRight, Sun, Calendar as CalendarIcon, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment)

interface AppointmentEvent {
  id: string
  title: string
  start: Date
  end: Date
  status: string
  patientName?: string
  dentistName?: string
  allDay?: boolean
}

export default function CalendarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<AppointmentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date())
  type CalendarView = 'month' | 'week' | 'day' | 'agenda'

  const [view, setView] = useState<CalendarView>('month')
  const [selectedEvent, setSelectedEvent] = useState<AppointmentEvent | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchEvents()
  }, [date, view])

  const fetchEvents = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile) return

    const startOfMonth = moment(date).startOf('month').toISOString()
    const endOfMonth = moment(date).endOf('month').toISOString()

    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(full_name),
        dentist:profiles!appointments_dentist_id_fkey(full_name),
        slot:slots(start_time, end_time)
      `)
      .in('status', ['pending', 'approved'])
      .gte('slots.start_time', startOfMonth)
      .lte('slots.start_time', endOfMonth)

    if (profile.role === 'patient') {
      query = query.eq('patient_id', profile.id)
    } else {
      query = query.eq('dentist_id', profile.id)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
    } else {
      const mappedEvents: AppointmentEvent[] = (data || []).map((apt: any) => ({
        id: apt.id,
        title: profile.role === 'patient' 
          ? `Dr. ${apt.dentist?.full_name || 'Dentist'}`
          : apt.patient?.full_name || 'Patient',
        start: new Date(apt.slot?.start_time),
        end: new Date(apt.slot?.end_time),
        status: apt.status,
        patientName: apt.patient?.full_name,
        dentistName: apt.dentist?.full_name,
      }))
      setEvents(mappedEvents)
    }
    setLoading(false)
  }

  const eventStyleGetter = (event: AppointmentEvent) => {
    const colors = {
      pending: { background: '#fef3c7', border: '#f59e0b', color: '#92400e' },
      approved: { background: '#dbeafe', border: '#3b82f6', color: '#1e40af' },
      rejected: { background: '#fee2e2', border: '#ef4444', color: '#991b1b' },
      cancelled: { background: '#f3f4f6', border: '#9ca3af', color: '#374151' },
      completed: { background: '#d1fae5', border: '#10b981', color: '#065f46' },
    }
    const style = colors[event.status as keyof typeof colors] || colors.pending
    return {
      style: {
        backgroundColor: style.background,
        borderColor: style.border,
        color: style.color,
        borderRadius: '4px',
        opacity: 0.9,
        display: 'block',
      },
    }
  }

  const handleNavigate = (newDate: Date, view: string, action: string) => {
    setDate(newDate)
  }

  const handleManualNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') {
      setDate(new Date())
    } else if (action === 'PREV') {
      setDate(moment(date).subtract(1, view === 'month' ? 'month' : 'week').toDate())
    } else if (action === 'NEXT') {
      setDate(moment(date).add(1, view === 'month' ? 'month' : 'week').toDate())
    }
  }

  const formatDate = (date: Date) => {
    return moment(date).format('MMMM YYYY')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const views: CalendarView[] = ['month', 'week', 'day', 'agenda']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600 mt-1">View and manage your appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            {views.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  view === v
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleManualNavigate('PREV')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleManualNavigate('TODAY')}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => handleManualNavigate('NEXT')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultDate={date}
          defaultView={view}
          views={views}
          onNavigate={handleNavigate}
          onSelectEvent={(event) => setSelectedEvent(event)}
          eventPropGetter={eventStyleGetter}
          min={moment().startOf('day').toDate()}
          max={moment().add(1, 'year').toDate()}
          step={30}
          timeslots={2}
          components={{
            toolbar: () => null,
          }}
        />
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Appointment Details</h2>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-500 hover:text-gray-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-medium', 
                  selectedEvent.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                  selectedEvent.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                )}>
                  {selectedEvent.title[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedEvent.title}</p>
                  <p className="text-sm text-gray-500">{selectedEvent.patientName || selectedEvent.dentistName}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                  <span>{formatDateTime(selectedEvent.start)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <span>{moment(selectedEvent.start).format('h:mm A')} - {moment(selectedEvent.end).format('h:mm A')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">Patient: {selectedEvent.patientName || 'N/A'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <span className={cn('badge flex-1 text-center', 
                  selectedEvent.status === 'approved' ? 'badge-approved' :
                  selectedEvent.status === 'pending' ? 'badge-pending' :
                  'badge-rejected'
                )}>
                  {(() => {
                    if (selectedEvent.status === 'approved') return <CheckCircle className="h-3 w-3 mr-1" />
                    if (selectedEvent.status === 'pending') return <AlertCircle className="h-3 w-3 mr-1" />
                    return <XCircle className="h-3 w-3 mr-1" />
                  })()}
                  {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-sm text-gray-600">Pending</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-sm text-gray-600">Approved</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-sm text-gray-600">Rejected</span>
        </div>
      </div>
    </div>
  )
}