-- Seed data for weekly attendance testing
-- This script inserts fake attendance data for testing the attendance plots
-- Run this after the database is set up with schema2.sql

\connect conductor

-- Get course ID (from schema2.sql seed data)
-- Course ID: 22222222-2222-2222-2222-222222222222

-- Get user IDs (from schema2.sql seed data)
-- student@school.edu: cccccccc-cccc-cccc-cccc-cccccccccccc
-- teamlead@school.edu: dddddddd-dddd-dddd-dddd-dddddddddddd
-- alex_teamlead@school.edu: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee

-- Create 7-day periods for testing (Nov 2025)
-- Period 1: Nov 1-7, 2025 (7 days: 1,2,3,4,5,6,7)
-- Period 2: Nov 8-14, 2025 (7 days: 8,9,10,11,12,13,14)
-- Period 3: Nov 15-21, 2025 (7 days: 15,16,17,18,19,20,21)
-- Period 4: Nov 22-28, 2025 (7 days: 22,23,24,25,26,27,28)

-- Insert attendance submissions for multiple users across multiple periods

-- Student 1 (student@school.edu) - Good attendance
INSERT INTO weekly_attendance_submissions (
  course_id,
  user_id,
  period_start_date,
  period_end_date,
  period_label,
  attendance_types
) VALUES
  -- Period 1: Nov 1-7 - Attended all
  (
    '22222222-2222-2222-2222-222222222222',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2025-11-01',
    '2025-11-07',
    'Nov 1-7',
    '{"class": true, "group_meeting": true, "office_hours": true, "class_meeting": true}'::jsonb
  ),
  -- Period 2: Nov 8-14 - Attended 3/4
  (
    '22222222-2222-2222-2222-222222222222',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2025-11-08',
    '2025-11-14',
    'Nov 8-14',
    '{"class": true, "group_meeting": true, "office_hours": false, "class_meeting": true}'::jsonb
  ),
  -- Period 3: Nov 15-21 - Attended 2/4
  (
    '22222222-2222-2222-2222-222222222222',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2025-11-15',
    '2025-11-21',
    'Nov 15-21',
    '{"class": true, "group_meeting": true, "office_hours": false, "class_meeting": false}'::jsonb
  ),
  -- Period 4: Nov 22-28 - Attended all
  (
    '22222222-2222-2222-2222-222222222222',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2025-11-22',
    '2025-11-28',
    'Nov 22-28',
    '{"class": true, "group_meeting": true, "office_hours": true, "class_meeting": true}'::jsonb
  );

-- Team Lead 1 (teamlead@school.edu) - Excellent attendance
INSERT INTO weekly_attendance_submissions (
  course_id,
  user_id,
  period_start_date,
  period_end_date,
  period_label,
  attendance_types
) VALUES
  -- Period 1: Nov 1-7 - Attended all
  (
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '2025-11-01',
    '2025-11-07',
    'Nov 1-7',
    '{"class": true, "group_meeting": true, "office_hours": true, "class_meeting": true}'::jsonb
  ),
  -- Period 2: Nov 8-14 - Attended all
  (
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '2025-11-08',
    '2025-11-14',
    'Nov 8-14',
    '{"class": true, "group_meeting": true, "office_hours": true, "class_meeting": true}'::jsonb
  ),
  -- Period 3: Nov 15-21 - Attended 3/4
  (
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '2025-11-15',
    '2025-11-21',
    'Nov 15-21',
    '{"class": true, "group_meeting": true, "office_hours": false, "class_meeting": true}'::jsonb
  ),
  -- Period 4: Nov 22-28 - Attended all
  (
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '2025-11-22',
    '2025-11-28',
    'Nov 22-28',
    '{"class": true, "group_meeting": true, "office_hours": true, "class_meeting": true}'::jsonb
  );

-- Team Lead 2 (alex_teamlead@school.edu) - Mixed attendance
INSERT INTO weekly_attendance_submissions (
  course_id,
  user_id,
  period_start_date,
  period_end_date,
  period_label,
  attendance_types
) VALUES
  -- Period 1: Nov 1-7 - Attended 2/4
  (
    '22222222-2222-2222-2222-222222222222',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2025-11-01',
    '2025-11-07',
    'Nov 1-7',
    '{"class": true, "group_meeting": true, "office_hours": false, "class_meeting": false}'::jsonb
  ),
  -- Period 2: Nov 8-14 - Attended 1/4
  (
    '22222222-2222-2222-2222-222222222222',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2025-11-08',
    '2025-11-14',
    'Nov 8-14',
    '{"class": true, "group_meeting": false, "office_hours": false, "class_meeting": false}'::jsonb
  ),
  -- Period 3: Nov 15-21 - Missing (will count as 0%)
  -- Period 4: Nov 22-28 - Attended 3/4
  (
    '22222222-2222-2222-2222-222222222222',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2025-11-22',
    '2025-11-28',
    'Nov 22-28',
    '{"class": true, "group_meeting": true, "office_hours": false, "class_meeting": true}'::jsonb
  );

-- Add more students if they exist in the database
-- You can check existing users with: SELECT id, email FROM users;

-- Example: If you have more users, you can add them like this:
-- INSERT INTO weekly_attendance_submissions (course_id, user_id, period_start_date, period_end_date, period_label, attendance_types)
-- SELECT 
--   '22222222-2222-2222-2222-222222222222',
--   u.id,
--   '2025-11-01',
--   '2025-11-07',
--   'Nov 1-7',
--   '{"class": true, "group_meeting": true, "office_hours": false, "class_meeting": true}'::jsonb
-- FROM users u
-- WHERE u.email LIKE '%student%'
--   AND u.id NOT IN (
--     SELECT user_id FROM weekly_attendance_submissions 
--     WHERE period_start_date = '2025-11-01'
--   )
-- LIMIT 5;

-- Summary of test data:
-- Period 1 (Nov 1-7): 
--   - Student (Grace): 100% (4/4)
--   - Team Lead 1 (Linus): 100% (4/4)
--   - Team Lead 2 (Alex): 50% (2/4)
--   Team 1 average (Grace + Linus): 100%
--
-- Period 2 (Nov 8-14):
--   - Student (Grace): 75% (3/4)
--   - Team Lead 1 (Linus): 100% (4/4)
--   - Team Lead 2 (Alex): 25% (1/4)
--   Team 1 average: 87.5%
--
-- Period 3 (Nov 15-21):
--   - Student (Grace): 50% (2/4)
--   - Team Lead 1 (Linus): 75% (3/4)
--   - Team Lead 2 (Alex): 0% (missing)
--   Team 1 average: 62.5%
--
-- Period 4 (Nov 22-28):
--   - Student (Grace): 100% (4/4)
--   - Team Lead 1 (Linus): 100% (4/4)
--   - Team Lead 2 (Alex): 75% (3/4)
--   Team 1 average: 100%

-- Note: Grace and Linus are in Team 1 (from schema2.sql seed data)
-- Alex is a separate team lead, so they won't be in the same team average

SELECT 'Attendance test data inserted successfully!' AS status;

-- Summary query (fixed GROUP BY)
SELECT 
  period_start_date,
  period_label,
  COUNT(*) as submissions,
  ROUND(AVG(
    (CASE WHEN (attendance_types->>'class')::boolean THEN 1 ELSE 0 END +
     CASE WHEN (attendance_types->>'group_meeting')::boolean THEN 1 ELSE 0 END +
     CASE WHEN (attendance_types->>'office_hours')::boolean THEN 1 ELSE 0 END +
     CASE WHEN (attendance_types->>'class_meeting')::boolean THEN 1 ELSE 0 END)::float / 4.0 * 100
  )::numeric, 2) as avg_attendance_rate
FROM weekly_attendance_submissions
GROUP BY period_start_date, period_label
ORDER BY period_start_date;

