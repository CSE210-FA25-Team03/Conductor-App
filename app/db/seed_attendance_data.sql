-- Seed data for attendance records testing (CORRECTED DESIGN)
-- This script inserts fake attendance data with actual dates for testing the attendance plots
-- Run this after the database is set up with schema2.sql

\connect conductor

-- Get course ID (from schema2.sql seed data)
-- Course ID: 22222222-2222-2222-2222-222222222222

-- Get user IDs (from schema2.sql seed data)
-- student@school.edu: cccccccc-cccc-cccc-cccc-cccccccccccc
-- teamlead@school.edu: dddddddd-dddd-dddd-dddd-dddddddddddd
-- alex_teamlead@school.edu: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee

-- Test data structure:
-- Period 1: Nov 1-7, 2025 (dates: 1,2,3,4,5,6,7)
-- Period 2: Nov 8-14, 2025 (dates: 8,9,10,11,12,13,14)
-- Period 3: Nov 15-21, 2025 (dates: 15,16,17,18,19,20,21)
-- Period 4: Nov 22-28, 2025 (dates: 22,23,24,25,26,27,28)

-- Insert attendance records with actual dates

-- Student 1 (student@school.edu) - Good attendance
-- Period 1: Nov 1-7 - Attended all types (4/4)
--   Class: Nov 2, Nov 5
--   Group Meeting: Nov 3
--   Office Hours: Nov 4
--   Class Meeting: Nov 6
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-02', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-05', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-03', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-04', 'office_hours'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-06', 'class_meeting');

-- Period 2: Nov 8-14 - Attended 3/4 types
--   Class: Nov 9, Nov 12
--   Group Meeting: Nov 10
--   Office Hours: (none - missing)
--   Class Meeting: Nov 13
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-09', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-12', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-10', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-13', 'class_meeting');

-- Period 3: Nov 15-21 - Attended 2/4 types
--   Class: Nov 16, Nov 19
--   Group Meeting: Nov 17
--   Office Hours: (none - missing)
--   Class Meeting: (none - missing)
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-16', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-19', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-17', 'group_meeting');

-- Period 4: Nov 22-28 - Attended all types (4/4)
--   Class: Nov 23, Nov 26
--   Group Meeting: Nov 24
--   Office Hours: Nov 25
--   Class Meeting: Nov 27
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-23', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-26', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-24', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-25', 'office_hours'),
  ('22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-11-27', 'class_meeting');

-- Team Lead 1 (teamlead@school.edu) - Excellent attendance
-- Period 1: Nov 1-7 - Attended all types (4/4)
--   Class: Nov 1, Nov 4, Nov 7
--   Group Meeting: Nov 2
--   Office Hours: Nov 3
--   Class Meeting: Nov 5
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-01', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-04', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-07', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-02', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-03', 'office_hours'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-05', 'class_meeting');

-- Period 2: Nov 8-14 - Attended all types (4/4)
--   Class: Nov 8, Nov 11, Nov 14
--   Group Meeting: Nov 9
--   Office Hours: Nov 10
--   Class Meeting: Nov 12
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-08', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-11', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-14', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-09', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-10', 'office_hours'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-12', 'class_meeting');

-- Period 3: Nov 15-21 - Attended 3/4 types
--   Class: Nov 15, Nov 18
--   Group Meeting: Nov 16
--   Office Hours: (none - missing)
--   Class Meeting: Nov 19
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-15', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-18', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-16', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-19', 'class_meeting');

-- Period 4: Nov 22-28 - Attended all types (4/4)
--   Class: Nov 22, Nov 25
--   Group Meeting: Nov 23
--   Office Hours: Nov 24
--   Class Meeting: Nov 26
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-22', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-25', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-23', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-24', 'office_hours'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-11-26', 'class_meeting');

-- Team Lead 2 (alex_teamlead@school.edu) - Mixed attendance
-- Period 1: Nov 1-7 - Attended 2/4 types
--   Class: Nov 3, Nov 6
--   Group Meeting: Nov 4
--   Office Hours: (none - missing)
--   Class Meeting: (none - missing)
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-03', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-06', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-04', 'group_meeting');

-- Period 2: Nov 8-14 - Attended 1/4 types
--   Class: Nov 9
--   Group Meeting: (none - missing)
--   Office Hours: (none - missing)
--   Class Meeting: (none - missing)
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-09', 'class');

-- Period 3: Nov 15-21 - Missing (will count as 0% when aggregated)
--   No records for this period

-- Period 4: Nov 22-28 - Attended 3/4 types
--   Class: Nov 22, Nov 25
--   Group Meeting: Nov 23
--   Office Hours: (none - missing)
--   Class Meeting: Nov 24
INSERT INTO attendance_records (course_id, user_id, attendance_date, attendance_type) VALUES
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-22', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-25', 'class'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-23', 'group_meeting'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2025-11-24', 'class_meeting');

SELECT 'Attendance test data inserted successfully!' AS status;

-- Summary query: Show attendance by calculated period
-- This demonstrates how periods are calculated from actual dates
SELECT 
  get_period_start(attendance_date) as period_start,
  get_period_end(attendance_date) as period_end,
  COUNT(DISTINCT user_id) as users_with_records,
  COUNT(DISTINCT attendance_type) as unique_types,
  COUNT(*) as total_records,
  attendance_type,
  COUNT(*) as type_count
FROM attendance_records
WHERE course_id = '22222222-2222-2222-2222-222222222222'
GROUP BY get_period_start(attendance_date), get_period_end(attendance_date), attendance_type
ORDER BY period_start, attendance_type;

-- Summary by period (aggregated)
SELECT 
  get_period_start(attendance_date) as period_start,
  get_period_end(attendance_date) as period_end,
  COUNT(DISTINCT user_id) as users_with_records,
  COUNT(DISTINCT attendance_type) as unique_types_per_period,
  COUNT(*) as total_records
FROM attendance_records
WHERE course_id = '22222222-2222-2222-2222-222222222222'
GROUP BY get_period_start(attendance_date), get_period_end(attendance_date)
ORDER BY period_start;

-- Expected results:
-- Period 1 (Nov 1-7): 
--   - Student (Grace): 4 unique types (100%)
--   - Team Lead 1 (Linus): 4 unique types (100%)
--   - Team Lead 2 (Alex): 2 unique types (50%)
--
-- Period 2 (Nov 8-14):
--   - Student (Grace): 3 unique types (75%)
--   - Team Lead 1 (Linus): 4 unique types (100%)
--   - Team Lead 2 (Alex): 1 unique type (25%)
--
-- Period 3 (Nov 15-21):
--   - Student (Grace): 2 unique types (50%)
--   - Team Lead 1 (Linus): 3 unique types (75%)
--   - Team Lead 2 (Alex): 0 unique types (0% - missing)
--
-- Period 4 (Nov 22-28):
--   - Student (Grace): 4 unique types (100%)
--   - Team Lead 1 (Linus): 4 unique types (100%)
--   - Team Lead 2 (Alex): 3 unique types (75%)
