-- pg_cron Setup for Toothpoint Reminders
-- Run this in Supabase SQL Editor AFTER enabling pg_cron extension

-- Enable pg_cron extension (requires superuser, run in Supabase Dashboard > Database > Extensions)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule reminder job to run every 15 minutes
-- This will call the /api/reminders endpoint
SELECT cron.schedule(
  'send-appointment-reminders',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

-- Alternative: If using Supabase Edge Functions for reminders
-- CREATE OR REPLACE FUNCTION send_reminders()
-- RETURNS void
-- LANGUAGE plpgsql
-- AS $$
-- DECLARE
--   v_result jsonb;
-- BEGIN
--   SELECT net.http_post(
--     url := 'https://your-project.supabase.co/functions/v1/reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   ) INTO v_result;
-- END;
-- $$;
--
-- SELECT cron.schedule('send-appointment-reminders', '*/15 * * * *', 'SELECT send_reminders();');

-- To unschedule the job:
-- SELECT cron.unschedule('send-appointment-reminders');

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To view job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;