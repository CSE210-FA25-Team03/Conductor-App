-- Migration: Add weekly attendance submission system
-- This adds support for weekly attendance submissions with flexible 7-day periods

------------------------------------------------------------
-- Weekly Attendance Submissions
------------------------------------------------------------

CREATE TABLE weekly_attendance_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start_date date NOT NULL,  -- Start date of 7-day period (e.g., 2025-11-01)
  period_end_date date NOT NULL,    -- End date of 7-day period (e.g., 2025-11-07)
  period_label text,                -- Optional: "Nov 1-7", "Week 8", etc.
  
  -- Attendance types stored as JSONB for flexibility (can add more types in future)
  -- Structure: { "class": true, "group_meeting": true, "office_hours": false, "class_meeting": true }
  attendance_types jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT weekly_attendance_submissions_unique 
    UNIQUE (course_id, user_id, period_start_date),
  CONSTRAINT period_dates_valid 
    CHECK (period_end_date >= period_start_date),
  CONSTRAINT period_length_valid 
    CHECK (period_end_date - period_start_date = 6)  -- Exactly 7 days (inclusive)
);

CREATE INDEX idx_weekly_attendance_course_period 
  ON weekly_attendance_submissions (course_id, period_start_date);

CREATE INDEX idx_weekly_attendance_user 
  ON weekly_attendance_submissions (user_id);

CREATE INDEX idx_weekly_attendance_period_range 
  ON weekly_attendance_submissions (period_start_date, period_end_date);

------------------------------------------------------------
-- Attendance Update Notifications
------------------------------------------------------------

CREATE TABLE attendance_update_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES weekly_attendance_submissions(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_lead_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  period_start_date date NOT NULL,
  notification_sent_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  
  CONSTRAINT attendance_update_notifications_unique
    UNIQUE (submission_id, team_lead_user_id)
);

CREATE INDEX idx_attendance_notifications_team_lead 
  ON attendance_update_notifications (team_lead_user_id, is_read);

CREATE INDEX idx_attendance_notifications_team 
  ON attendance_update_notifications (team_id);

CREATE INDEX idx_attendance_notifications_submission 
  ON attendance_update_notifications (submission_id);

