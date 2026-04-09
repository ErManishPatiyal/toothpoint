'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, User, MapPin, Phone, Mail, AlertCircle, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

export default function AppointmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const appointmentId = params.id as string

  const [appointment, setAppointment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchAppointment()
  }, [])

  const fetchAppointment = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(full_name, phone, email),
        dentist:profiles!appointments_dentist_id_fkey(full_name, phone, email),
        slot:slots(start_time, end_time)
      `)
      .eq('id', appointmentId)
      .single()

    if (error) {
      setError(error.message)
    } else {
      setAppointment(data)
    }
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return

    setCancelling(true)
    setError('')

    try {
      const { error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: appointmentId,
      })

      if (error) throw error

      setSuccess('Appointment cancelled successfully')
      setTimeout(() => {
        router.push('/calendar')
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const statusConfig = {
    pending: { label: 'Pending Approval', color: 'badge-pending', icon: AlertCircle, description: 'The dentist will review your request and approve or reject it.' },
    approved: { label: 'Approved', color: 'badge-approved', icon: CheckCircle, description: 'Your appointment is confirmed. You will receive reminders before the appointment.' },
    rejected: { label: 'Rejected', color: 'badge-rejected', icon: XCircle, description: 'The dentist was unable to accommodate this time. Please book another slot.' },
    cancelled: { label: 'Cancelled', color: 'badge-cancelled', icon: XCircle, description: 'This appointment has been cancelled.' },
    completed: { label: 'Completed', color: 'badge-completed', icon: CheckCircle, description: 'This appointment has been completed.' },
  }

  const config = statusConfig[appointment?.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = config.icon

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="card text-center py-16 max-w-2xl mx-auto">
        <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Appointment not found</h3>
        <Link href="/calendar" className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Calendar
        </Link>
      </div>
    )
  }

  const isPatient = appointment.patient?.id === appointment.patient_id
  const canCancel = ['pending', 'approved'].includes(appointment.status) && isPatient

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/calendar" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointment Details</h1>
          <p className="text-gray-600 mt-1">View and manage your appointment</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
          <CheckCircle className="h-4 w-4" />
          <span>{success}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={cn('w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl',
              appointment.status === 'approved' ? 'bg-blue-100 text-blue-700' :
              appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            )}>
              {appointment.dentist?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">Dr. {appointment.dentist?.full_name || 'Dentist'}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={cn('badge', config.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="font-medium text-gray-900">{appointment.slot && formatDateTime(appointment.slot.start_time)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium text-gray-900">
                  {appointment.slot && `${formatDateTime(appointment.slot.start_time)} - ${formatDateTime(appointment.slot.end_time)}`}
                </p>
              </div>
            </div>

            {appointment.notes && (
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mt-1">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium text-gray-900">{appointment.notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <StatusIcon className="h-4 w-4" />
              {config.description}
            </p>
          </div>

          {canCancel && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="btn-danger w-full flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Cancel Appointment
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {appointment.dentist?.phone && (
                <a href={`tel:${appointment.dentist.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                  <Phone className="h-4 w-4" />
                  <span>{appointment.dentist.phone}</span>
                </a>
              )}
              {appointment.dentist?.email && (
                <a href={`mailto:${appointment.dentist.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                  <Mail className="h-4 w-4" />
                  <span>{appointment.dentist.email}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}