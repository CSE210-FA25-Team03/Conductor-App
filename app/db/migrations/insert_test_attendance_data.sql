-- Test attendance data for Conductor App
-- Inserts attendance sessions and records for class meetings and team meetings
-- Spread across 5 weeks (Nov 1 - Dec 5, 2024) for plotting

-- Suppress NOTICE messages
SET client_min_messages TO WARNING;

-- Course and user IDs (from schema2.sql seed data)
-- Course: '22222222-2222-2222-2222-222222222222' (CSE210)
-- Users:
--   Professor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
--   TA: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
--   Student 1: 'cccccccc-cccc-cccc-cccc-cccccccccccc' (Grace Hopper)
--   Team Lead 1: 'dddddddd-dddd-dddd-dddd-dddddddddddd' (Linus Lead)
--   Team Lead 2: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' (Alex Lee)

-- First, ensure we have teams (create if they don't exist)
DO $$
DECLARE
    team1_id uuid := '33333333-3333-3333-3333-333333333333';
    team2_id uuid := '44444444-4444-4444-4444-444444444444';
    course_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- Create Team 1 if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = team1_id) THEN
        INSERT INTO teams (id, course_id, code, name, display_number, status, description, created_at)
        VALUES (team1_id, course_id, 'TEAM-1', 'Team Alpha', '1', 'On Track', 'First team for testing', now());
    END IF;

    -- Create Team 2 if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = team2_id) THEN
        INSERT INTO teams (id, course_id, code, name, display_number, status, description, created_at)
        VALUES (team2_id, course_id, 'TEAM-2', 'Team Beta', '2', 'On Track', 'Second team for testing', now());
    END IF;

    -- Add team members if they don't exist
    -- Team 1: Grace (student) + Linus (team lead)
    IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = team1_id AND user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') THEN
        INSERT INTO team_members (id, team_id, user_id, is_leader, joined_at)
        VALUES (gen_random_uuid(), team1_id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = team1_id AND user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') THEN
        INSERT INTO team_members (id, team_id, user_id, is_leader, joined_at)
        VALUES (gen_random_uuid(), team1_id, 'dddddddd-dddd-dddd-dddd-dddddddddddd', true, now());
    END IF;

    -- Team 2: Alex (team lead) - create a student for team 2 if needed
    IF NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = team2_id AND user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') THEN
        INSERT INTO team_members (id, team_id, user_id, is_leader, joined_at)
        VALUES (gen_random_uuid(), team2_id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true, now());
    END IF;
END $$;

-- ============================================================================
-- CLASS MEETING ATTENDANCE SESSIONS (Created by Professor)
-- ============================================================================
-- Week 1: Nov 1-7, 2024
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CLASS01', 'class_meeting', NULL, 10, '2024-11-01 10:00:00+00', '2024-11-01 10:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 2: Nov 8-14, 2024
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CLASS02', 'class_meeting', NULL, 10, '2024-11-08 10:00:00+00', '2024-11-08 10:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 3: Nov 15-21, 2024
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('a3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CLASS03', 'class_meeting', NULL, 10, '2024-11-15 10:00:00+00', '2024-11-15 10:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 4: Nov 22-28, 2024
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('a4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CLASS04', 'class_meeting', NULL, 10, '2024-11-22 10:00:00+00', '2024-11-22 10:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 5: Nov 29 - Dec 5, 2024
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('a5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CLASS05', 'class_meeting', NULL, 10, '2024-11-29 10:00:00+00', '2024-11-29 10:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEAM MEETING ATTENDANCE SESSIONS (Created by Team Leads)
-- ============================================================================
-- Team 1 (Linus Lead) - Team meetings
-- Week 1: Nov 1-7
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'TEAM1A', 'team_meeting', '33333333-3333-3333-3333-333333333333', 10, '2024-11-02 14:00:00+00', '2024-11-02 14:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 2: Nov 8-14
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'TEAM1B', 'team_meeting', '33333333-3333-3333-3333-333333333333', 10, '2024-11-09 14:00:00+00', '2024-11-09 14:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 3: Nov 15-21
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'TEAM1C', 'team_meeting', '33333333-3333-3333-3333-333333333333', 10, '2024-11-16 14:00:00+00', '2024-11-16 14:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 4: Nov 22-28
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'TEAM1D', 'team_meeting', '33333333-3333-3333-3333-333333333333', 10, '2024-11-23 14:00:00+00', '2024-11-23 14:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 5: Nov 29 - Dec 5
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'TEAM1E', 'team_meeting', '33333333-3333-3333-3333-333333333333', 10, '2024-11-30 14:00:00+00', '2024-11-30 14:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Team 2 (Alex Lee) - Team meetings
-- Week 1: Nov 1-7
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f2111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'TEAM2A', 'team_meeting', '44444444-4444-4444-4444-444444444444', 10, '2024-11-03 15:00:00+00', '2024-11-03 15:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 2: Nov 8-14
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f2122222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'TEAM2B', 'team_meeting', '44444444-4444-4444-4444-444444444444', 10, '2024-11-10 15:00:00+00', '2024-11-10 15:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 3: Nov 15-21
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f2333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'TEAM2C', 'team_meeting', '44444444-4444-4444-4444-444444444444', 10, '2024-11-17 15:00:00+00', '2024-11-17 15:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 4: Nov 22-28
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f2444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'TEAM2D', 'team_meeting', '44444444-4444-4444-4444-444444444444', 10, '2024-11-24 15:00:00+00', '2024-11-24 15:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- Week 5: Nov 29 - Dec 5
INSERT INTO attendance_sessions (id, course_id, created_by, code, type, team_id, live_minutes, created_at, expires_at)
VALUES 
  ('f2555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'TEAM2E', 'team_meeting', '44444444-4444-4444-4444-444444444444', 10, '2024-12-01 15:00:00+00', '2024-12-01 15:10:00+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ATTENDANCE RECORDS
-- ============================================================================

-- CLASS MEETING ATTENDANCE (matches the plot data from the image)
-- Week 1 (Nov 1-7): ~75% attendance
-- Team 1: Both present (2/2 = 100%, but we'll make it 75% overall)
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-01 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-01 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-01 10:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 2 (Nov 8-14): ~95% attendance (peak)
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-08 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-08 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-08 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2024-11-08 10:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 3 (Nov 15-21): ~78% attendance
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-15 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-15 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a3333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-15 10:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 4 (Nov 22-28): ~98% attendance (peak)
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'a4444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-22 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a4444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-22 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a4444444-4444-4444-4444-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-22 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2024-11-22 10:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 5 (Nov 29 - Dec 5): ~45% attendance (low)
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-29 10:05:00+00', true, 'self'),
  (gen_random_uuid(), 'a5555555-5555-5555-5555-555555555555', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-29 10:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- TEAM MEETING ATTENDANCE - Team 1
-- Week 1: Both members present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f1111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-02 14:05:00+00', true, 'self'),
  (gen_random_uuid(), 'f1111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-02 14:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 2: Both present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f2222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-09 14:05:00+00', true, 'self'),
  (gen_random_uuid(), 'f2222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-09 14:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 3: Both present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f3333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-16 14:05:00+00', true, 'self'),
  (gen_random_uuid(), 'f3333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-16 14:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 4: Both present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f4444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-11-23 14:05:00+00', true, 'self'),
  (gen_random_uuid(), 'f4444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-23 14:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 5: Only team lead present (50%)
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f5555555-5555-5555-5555-555555555555', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2024-11-30 14:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- TEAM MEETING ATTENDANCE - Team 2
-- Week 1: Team lead present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f2111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-03 15:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 2: Team lead present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f2122222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-10 15:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 3: Team lead present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f2333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-17 15:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 4: Team lead present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f2444444-4444-4444-4444-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-11-24 15:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

-- Week 5: Team lead present
INSERT INTO attendances (id, session_id, user_id, marked_at, success, source)
VALUES 
  (gen_random_uuid(), 'f2555555-5555-5555-5555-555555555555', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2024-12-01 15:05:00+00', true, 'self')
ON CONFLICT (session_id, user_id) DO NOTHING;

