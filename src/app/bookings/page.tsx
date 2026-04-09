'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Clock, User, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatDateTime, cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default function BookingsPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchAppointments()
  }, [filter])

  const fetchAppointments = async () => {
    setLoading(true)
    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(full_name, phone, email),
        slot:slots(start_time, end_time)
      `)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
    } else {
      setAppointments(data || [])
    }
    setLoading(false)
  }

  const handleStatusChange = async (appointmentId: string, newStatus: 'approved' | 'rejected') => {
    setUpdating(appointmentId)
    setError('')

    try {
      const { error } = await supabase.rpc('update_appointment_status', {
        p_appointment_id: appointmentId,
        p_status: newStatus,
      })

      if (error) throw error

      setSuccess(`Appointment ${newStatus}`)
      fetchAppointments()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const statusColors = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    cancelled: 'badge-cancelled',
    completed: 'badge-completed',
  }

  const statusIcons = {
    pending: AlertCircle,
    approved: CheckCircle2,
    rejected: XCircle,
    cancelled: XCircle,
    completed: CheckCircle,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const filteredAppointments = appointments

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Booking Requests</h1>
          <p className="text-gray-600 mt-1">Review and manage patient appointment requests</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
              filter === status
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
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

      {filteredAppointments.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            {filter === 'pending' ? 'No pending requests' : `No ${filter} appointments`}
          </h3>
          <p className="text-gray-500 mt-1">
            {filter === 'pending'
              ? 'When patients request appointments, they\'ll appear here for your review'
              : 'Appointments with this status will appear here'}
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-gray-100">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-lg">
                      {appointment.patient?.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{appointment.patient?.full_name || 'Unknown'}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {appointment.slot && formatDateTime(appointment.slot.start_time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {appointment.slot && `${formatDateTime(appointment.slot.start_time)} - ${formatDateTime(appointment.slot.end_time)}`}
                        </span>
                        {appointment.patient?.phone && (
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {appointment.patient.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={cn('badge', statusColors[appointment.status as keyof typeof statusColors] || 'badge-pending')}>
                      {(() => {
                        const Icon = statusIcons[appointment.status as keyof typeof statusIcons] || AlertCircle
                        return <Icon className="h-3 w-3 mr-1" />
                      })()}
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </span>

                    {appointment.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(appointment.id, 'approved')}
                          disabled={updating === appointment.id}
                          className="btn-primary flex items-center gap-2 text-sm"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(appointment.id, 'rejected')}
                          disabled={updating === appointment.id}
                          className="btn-danger flex items-center gap-2 text-sm"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {appointment.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notes:</span> {appointment.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}