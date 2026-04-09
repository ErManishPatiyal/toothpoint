'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, X, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

export default function AvailabilityPage() {
  const router = useRouter()
  const supabase = createClient()
  const [availabilities, setAvailabilities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_active: true,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchAvailabilities()
  }, [])

  const fetchAvailabilities = async () => {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setAvailabilities(data || [])
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (editingId) {
        const { error } = await supabase
          .from('availability')
          .update(formData)
          .eq('id', editingId)

        if (error) throw error
        setSuccess('Availability updated successfully')
      } else {
        const { error } = await supabase
          .from('availability')
          .insert(formData)

        if (error) throw error
        setSuccess('Availability added successfully')
      }

      setShowModal(false)
      setEditingId(null)
      resetForm()
      fetchAvailabilities()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (availability: any) => {
    setFormData({
      day_of_week: availability.day_of_week,
      start_time: availability.start_time.slice(0, 5),
      end_time: availability.end_time.slice(0, 5),
      is_active: availability.is_active,
    })
    setEditingId(availability.id)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this availability?')) return

    const { error } = await supabase.from('availability').delete().eq('id', id)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Availability deleted')
      fetchAvailabilities()
    }
  }

  const handleGenerateSlots = async () => {
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase.rpc('generate_slots_for_dentist', {
        p_weeks_ahead: 4,
      })

      if (error) throw error
      setSuccess('Slots generated for the next 4 weeks!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      is_active: true,
    })
  }

  const openModal = () => {
    resetForm()
    setEditingId(null)
    setShowModal(true)
  }

  const groupedAvailabilities = DAYS.map((day) => ({
    day,
    slots: availabilities.filter((a) => a.day_of_week === day.value),
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Weekly Availability</h1>
          <p className="text-gray-600 mt-1">Set your recurring weekly schedule. Slots are generated automatically.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleGenerateSlots} disabled={saving} className="btn-secondary flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Generate Slots (4 weeks)
          </button>
          <button onClick={openModal} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Availability
          </button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupedAvailabilities.map(({ day, slots }) => (
          <div key={day.value} className="card">
            <div className="card-header bg-gray-50">
              <h3 className="font-semibold text-gray-900 capitalize">{day.label}</h3>
            </div>
            <div className="card-body p-4 space-y-3">
              {slots.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No hours set</p>
              ) : (
                slots.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {slot.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(slot)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Edit Availability' : 'Add Availability'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="day_of_week" className="label">Day of Week</label>
                <select
                  id="day_of_week"
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: Number(e.target.value) })}
                  className="input"
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_time" className="label">Start Time</label>
                  <input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="end_time" className="label">End Time</label>
                  <input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingId(null); }}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}