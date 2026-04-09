'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, Calendar, Clock, MapPin, Star, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import { formatTime, cn } from '@/lib/utils'
import Link from 'next/link'

interface Dentist {
  id: string
  full_name: string
  phone?: string
  avatar_url?: string
  availabilities?: any[]
  slots?: any[]
}

export default function DentistsPage() {
  const supabase = createClient()
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDentists()
  }, [])

  const fetchDentists = async () => {
    setLoading(true)
    let query = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone,
        avatar_url,
        availabilities:availability(day_of_week, start_time, end_time, is_active)
      `)
      .eq('role', 'dentist')

    if (search) {
      query = query.ilike('full_name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
    } else {
      setDentists(data || [])
    }
    setLoading(false)
  }

  const filteredDentists = dentists.filter((dentist) => {
    if (selectedDay === null) return true
    return dentist.availabilities?.some(
      (a) => a.day_of_week === selectedDay && a.is_active
    )
  })

  const getAvailableSlots = (dentist: Dentist) => {
    if (!dentist.slots) return 0
    return dentist.slots.filter((s: any) => !s.is_booked && !s.is_blocked && new Date(s.start_time) > new Date()).length
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-12 w-12 rounded-full bg-gray-200 mb-4" />
            <div className="h-6 w-3/4 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Find a Dentist</h1>
          <p className="text-gray-600 mt-1">Browse available dentists and book your appointment</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, index) => (
              <button
                key={day}
                onClick={() => setSelectedDay(selectedDay === index ? null : index)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                  selectedDay === index
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                )}
              >
                {day}
              </button>
            ))}
            {selectedDay !== null && (
              <button
                onClick={() => setSelectedDay(null)}
                className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {filteredDentists.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No dentists found</h3>
          <p className="text-gray-500 mt-1">
            {search || selectedDay !== null ? 'Try adjusting your search or filters' : 'No dentists have registered yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDentists.map((dentist) => (
            <div key={dentist.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
                    {dentist.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Dr. {dentist.full_name}</h3>
                    {dentist.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <span className="h-4 w-4" />
                        {dentist.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {dentist.availabilities
                    ?.filter((a) => a.is_active)
                    .slice(0, 3)
                    .map((avail) => (
                      <div key={`${avail.day_of_week}-${avail.start_time}`} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 capitalize">{DAYS[avail.day_of_week]}</span>
                        <span className="font-medium text-gray-900">
                          {formatTime(avail.start_time)} - {formatTime(avail.end_time)}
                        </span>
                      </div>
                    ))}
                  {dentist.availabilities && dentist.availabilities.filter((a) => a.is_active).length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{dentist.availabilities.filter((a) => a.is_active).length - 3} more days
                    </p>
                  )}
                </div>

                <Link
                  href={`/dentists/${dentist.id}/book`}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Book Appointment
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}