-- Toothpoint Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('patient', 'dentist')) NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability table (recurring weekly schedule)
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dentist_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dentist_id, day_of_week, start_time, end_time)
);

-- Slots table (generated time slots)
CREATE TABLE slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dentist_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_booked BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dentist_id, start_time, end_time)
);

-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  dentist_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES slots(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscriptions for Web Push
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Notification logs
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('booking_request', 'booking_approved', 'booking_rejected', 'reminder_24h', 'reminder_1h', 'cancellation')) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_availability_dentist_id ON availability(dentist_id);
CREATE INDEX idx_slots_dentist_id ON slots(dentist_id);
CREATE INDEX idx_slots_start_time ON slots(start_time);
CREATE INDEX idx_slots_is_booked ON slots(is_booked) WHERE is_booked = FALSE;
CREATE INDEX idx_slots_is_blocked ON slots(is_blocked) WHERE is_blocked = FALSE;
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_dentist_id ON appointments(dentist_id);
CREATE INDEX idx_appointments_slot_id ON appointments(slot_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_type ON notification_logs(type);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Dentists can view all patient profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'dentist'
    )
    AND role = 'patient'
  );

-- Availability policies
CREATE POLICY "Dentists can manage own availability" ON availability
  FOR ALL USING (
    dentist_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'dentist'
    )
  );

CREATE POLICY "Patients can view active availability" ON availability
  FOR SELECT USING (is_active = TRUE);

-- Slots policies
CREATE POLICY "Dentists can manage own slots" ON slots
  FOR ALL USING (
    dentist_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'dentist'
    )
  );

CREATE POLICY "Patients can view available slots" ON slots
  FOR SELECT USING (is_booked = FALSE AND is_blocked = FALSE);

-- Appointments policies
CREATE POLICY "Patients can view own appointments" ON appointments
  FOR SELECT USING (
    patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Dentists can view appointments for their slots" ON appointments
  FOR SELECT USING (
    dentist_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'dentist')
  );

CREATE POLICY "Patients can create appointments" ON appointments
  FOR INSERT WITH CHECK (
    patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'patient')
    AND EXISTS (
      SELECT 1 FROM slots s
      WHERE s.id = slot_id AND s.is_booked = FALSE AND s.is_blocked = FALSE
    )
  );

CREATE POLICY "Dentists can update appointment status" ON appointments
  FOR UPDATE USING (
    dentist_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'dentist')
  );

CREATE POLICY "Patients can cancel own pending appointments" ON appointments
  FOR UPDATE USING (
    patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'patient')
    AND status = 'pending'
  );

-- Push subscriptions policies
CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Notification logs policies
CREATE POLICY "Users can view own notification logs" ON notification_logs
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Function to generate slots from availability
CREATE OR REPLACE FUNCTION generate_slots_for_dentist(p_dentist_id UUID, p_weeks_ahead INTEGER DEFAULT 4)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_availability RECORD;
  v_start_date DATE;
  v_end_date DATE;
  v_current_date DATE;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_slot_duration INTERVAL := '30 minutes';
BEGIN
  v_start_date := CURRENT_DATE;
  v_end_date := CURRENT_DATE + (p_weeks_ahead * INTERVAL '1 week');

  FOR v_availability IN
    SELECT * FROM availability
    WHERE dentist_id = p_dentist_id AND is_active = TRUE
  LOOP
    v_current_date := v_start_date;
    
    WHILE v_current_date <= v_end_date LOOP
      IF EXTRACT(DOW FROM v_current_date)::INTEGER = v_availability.day_of_week THEN
        v_slot_start := (v_current_date + v_availability.start_time) AT TIME ZONE 'UTC';
        v_slot_end := (v_current_date + v_availability.end_time) AT TIME ZONE 'UTC';
        
        WHILE v_slot_start + v_slot_duration <= v_slot_end LOOP
          INSERT INTO slots (dentist_id, start_time, end_time)
          VALUES (p_dentist_id, v_slot_start, v_slot_start + v_slot_duration)
          ON CONFLICT (dentist_id, start_time, end_time) DO NOTHING;
          
          v_slot_start := v_slot_start + v_slot_duration;
        END LOOP;
      END IF;
      
      v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
END;
$$;

-- Function to atomically book a slot (prevents race conditions)
CREATE OR REPLACE FUNCTION book_slot_atomic(p_slot_id UUID, p_patient_id UUID)
RETURNS TABLE(success BOOLEAN, appointment_id UUID, error TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_appointment_id UUID;
  v_dentist_id UUID;
BEGIN
  -- Try to lock the slot and mark as booked atomically
  UPDATE slots
  SET is_booked = TRUE, updated_at = NOW()
  WHERE id = p_slot_id AND is_booked = FALSE AND is_blocked = FALSE
  RETURNING dentist_id INTO v_dentist_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Slot not available or already booked';
    RETURN;
  END IF;

  -- Create the appointment
  INSERT INTO appointments (patient_id, dentist_id, slot_id, status)
  VALUES (p_patient_id, v_dentist_id, p_slot_id, 'pending')
  RETURNING id INTO v_appointment_id;

  RETURN QUERY SELECT TRUE, v_appointment_id, NULL;
EXCEPTION WHEN OTHERS THEN
  -- Rollback slot booking on error
  UPDATE slots SET is_booked = FALSE, updated_at = NOW() WHERE id = p_slot_id;
  RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM;
END;
$$;

-- Function to approve/reject appointment
CREATE OR REPLACE FUNCTION update_appointment_status(p_appointment_id UUID, p_status TEXT, p_dentist_id UUID)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status TEXT;
  v_slot_id UUID;
  v_patient_id UUID;
BEGIN
  -- Verify dentist owns this appointment
  SELECT status, slot_id, patient_id INTO v_old_status, v_slot_id, v_patient_id
  FROM appointments
  WHERE id = p_appointment_id AND dentist_id = p_dentist_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Appointment not found or unauthorized';
    RETURN;
  END IF;

  IF v_old_status != 'pending' THEN
    RETURN QUERY SELECT FALSE, 'Only pending appointments can be updated';
    RETURN;
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN QUERY SELECT FALSE, 'Invalid status';
    RETURN;
  END IF;

  -- Update appointment status
  UPDATE appointments
  SET status = p_status, updated_at = NOW()
  WHERE id = p_appointment_id;

  -- If rejected, free up the slot
  IF p_status = 'rejected' THEN
    UPDATE slots SET is_booked = FALSE, updated_at = NOW() WHERE id = v_slot_id;
  END IF;

  RETURN QUERY SELECT TRUE, NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM;
END;
$$;

-- Function to cancel appointment (by patient)
CREATE OR REPLACE FUNCTION cancel_appointment(p_appointment_id UUID, p_patient_id UUID)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_slot_id UUID;
BEGIN
  SELECT status, slot_id INTO v_status, v_slot_id
  FROM appointments
  WHERE id = p_appointment_id AND patient_id = p_patient_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Appointment not found';
    RETURN;
  END IF;

  IF v_status NOT IN ('pending', 'approved') THEN
    RETURN QUERY SELECT FALSE, 'Cannot cancel this appointment';
    RETURN;
  END IF;

  UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = p_appointment_id;
  UPDATE slots SET is_booked = FALSE, updated_at = NOW() WHERE id = v_slot_id;

  RETURN QUERY SELECT TRUE, NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, SQLERRM;
END;
$$;

-- Function to send notification
CREATE OR REPLACE FUNCTION log_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notification_logs (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE slots;