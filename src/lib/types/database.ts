export type UserRole = 'patient' | 'dentist'

export interface Profile {
  id: string
  user_id: string
  role: UserRole
  full_name: string
  phone?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Availability {
  id: string
  dentist_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Slot {
  id: string
  dentist_id: string
  start_time: string
  end_time: string
  is_booked: boolean
  is_blocked: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  patient_id: string
  dentist_id: string
  slot_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed'
  notes?: string
  created_at: string
  updated_at: string
  profiles_patient?: Profile
  profiles_dentist?: Profile
  slots?: Slot
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export interface NotificationLog {
  id: string
  user_id: string
  type: 'booking_request' | 'booking_approved' | 'booking_rejected' | 'reminder_24h' | 'reminder_1h' | 'cancellation'
  title: string
  body: string
  data?: Record<string, any>
  sent: boolean
  sent_at?: string
  error?: string
  created_at: string
}

export interface DentistWithAvailability extends Profile {
  availabilities?: Availability[]
  slots?: Slot[]
}

export interface BookingSlot extends Slot {
  dentist?: Profile
}