'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { formatDate, formatTime, cn } from '@/lib/utils'
import Link from 'next/link'

interface Slot {
  id: string
  start_time: string
  end_time: string
  is_booked: boolean
  is_blocked: boolean
}

interface Dentist {
  id: string
  full_name: string
}

export default function BookAppointmentPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const dentistId = params.id as string

  const [dentist, setDentist] = useState<Dentist | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchDentist()
  }, [])

  useEffect(() => {
    fetchSlots()
  }, [selectedDate])

  const fetchDentist = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', dentistId)
      .single()

    if (error) {
      setError(error.message)
    } else {
      setDentist(data)
    }
  }

  const fetchSlots = async () => {
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('dentist_id', dentistId)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .eq('is_blocked', false)
      .order('start_time', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setSlots(data || [])
    }
    setLoading(false)
  }

  const handleBook = async () => {
    if (!selectedSlot) return

    setBooking(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      const { data, error } = await supabase.rpc('book_slot_atomic', {
        p_slot_id: selectedSlot,
        p_patient_id: profile.id,
      })

      if (error) throw error

      if (!data?.[0]?.success) {
        throw new Error(data?.[0]?.error || 'Booking failed')
      }

      setSuccess('Appointment requested successfully!')
      setSelectedSlot(null)
      setNotes('')
      fetchSlots()
      
      setTimeout(() => {
        router.push('/calendar')
        router.refresh()
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBooking(false)
    }
  }

  const availableSlots = slots.filter((s) => !s.is_booked)
  const bookedSlots = slots.filter((s) => s.is_booked)

  const groupedSlots = availableSlots.reduce((acc, slot) => {
    const dateKey = new Date(slot.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(slot)
    return acc
  }, {} as Record<string, Slot[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!dentist) {
    return (
      <div className="card text-center py-16">
        <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Dentist not found</h3>
        <Link href="/dentists" className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Dentists
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dentists" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Book with Dr. {dentist.full_name}</h1>
          <p className="text-gray-600 mt-1">Select an available time slot</p>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Available Slots</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 86400000))}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-medium text-gray-900 min-w-[150px] text-center">
                {formatDate(selectedDate)}
              </span>
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 86400000))}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {Object.keys(groupedSlots).length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No available slots</h3>
              <p className="text-gray-500 mt-1">Try another date or check back later</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSlots).map(([dateKey, daySlots]) => (
                <div key={dateKey}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">{dateKey}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
                        disabled={slot.is_booked}
                        className={cn(
                          'p-3 rounded-lg border-2 text-sm font-medium transition-all',
                          selectedSlot === slot.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(slot.start_time)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {bookedSlots.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Booked Slots</h3>
              <div className="flex flex-wrap gap-2">
                {bookedSlots.slice(0, 10).map((slot) => (
                  <span
                    key={slot.id}
                    className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded line-through"
                  >
                    {formatTime(slot.start_time)}
                  </span>
                ))}
                {bookedSlots.length > 10 && (
                  <span className="px-2 py-1 text-xs text-gray-500">
                    +{bookedSlots.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="card">
          <div className="card-body p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Booking</h3>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="font-medium text-gray-900">Dr. {dentist.full_name}</p>
              <p className="text-gray-600">
                {formatDate(new Date(selectedSlot))} at {formatTime(selectedSlot)}
              </p>
            </div>
            <div className="mb-4">
              <label htmlFor="notes" className="label">Notes (optional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any specific concerns or requests for the dentist..."
                className="input"
              />
            </div>
            <div className="flex gap-3">
              <Link href="/dentists" className="btn-outline flex-1">
                Cancel
              </Link>
              <button
                onClick={handleBook}
                disabled={booking}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Request Appointment
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              This is a booking request. The dentist will review and approve or reject it.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}