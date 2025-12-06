-- schema_and_seed.sql
-- Complete schema + seed data for Conductor (dev).

------------------------------------------------------------
-- 0. Drop & recreate database
------------------------------------------------------------

DROP DATABASE IF EXISTS conductor;

CREATE DATABASE conductor
  WITH TEMPLATE = template0
       ENCODING = 'UTF8'
       LOCALE = 'en_US.UTF-8';

\connect conductor

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

SET search_path TO public;

------------------------------------------------------------
-- 1. Core identity & roles
------------------------------------------------------------

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE,
  email_verified_at timestamptz,
  given_name        text,
  family_name       text,
  display_name      text,
  pronouns          text,
  locale            text NOT NULL DEFAULT 'en',
  time_zone         text NOT NULL DEFAULT 'America/Los_Angeles',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name_pronunciation text,
  photo_url          text,
  phone              text,
  email              text,
  pronouns           text,
  availability_notes text,
  public_link        text,
  custom             jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key   text NOT NULL UNIQUE, -- e.g. 'professor', 'student', 'ta', 'tutor', 'admin'
  label text NOT NULL
);

CREATE TABLE role_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('global','course','section','team')),
  scope_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_assignments_user_role_scope_unique
    UNIQUE (user_id, role_id, scope_type, scope_id)
);

------------------------------------------------------------
-- 2. Terms, courses, rosters
------------------------------------------------------------

CREATE TABLE terms (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text NOT NULL UNIQUE, -- e.g. 'FA25'
  name      text NOT NULL,        -- e.g. 'Fall 2025'
  starts_on date,
  ends_on   date
);

CREATE TABLE courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id         uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  code            text NOT NULL,  -- e.g. 'CSE110'
  title           text NOT NULL,
  sectioning_mode text NOT NULL DEFAULT 'single',
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_term_code_unique UNIQUE (term_id, code)
);

CREATE TABLE course_info (
  course_id   uuid PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  homepage_url text,
  links       jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_memberships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id    uuid,
  status        text NOT NULL DEFAULT 'active',
  roster_source text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_memberships_course_user_unique
    UNIQUE (course_id, user_id)
);

------------------------------------------------------------
-- 3. Teams & staff/team relationships
------------------------------------------------------------

CREATE TABLE teams (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code               text NOT NULL, -- machine-ish code (e.g. 'team-1')
  name               text NOT NULL, -- display name
  display_number     text,
  status             text,          -- 'On Track', 'At Risk', etc.
  description        text,
  status_description text,
  repo_url           text,
  next_sync_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_course_code_unique UNIQUE (course_id, code)
);

CREATE TABLE team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_leader  boolean NOT NULL DEFAULT false,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id)
);

CREATE TABLE team_ta_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  ta_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_ta_assignments_team_unique UNIQUE (team_id)
);

------------------------------------------------------------
-- 4. Class events / calendar
------------------------------------------------------------

CREATE TABLE class_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  type        text NOT NULL,     -- e.g. 'Assignment', 'Exam'
  starts_at   timestamptz,
  due_at      timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------
-- 5. Group formation (skills & ratings)
------------------------------------------------------------

CREATE TABLE skills (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  weight      numeric(5,2) NOT NULL DEFAULT 0,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skills_course_name_unique UNIQUE (course_id, name)
);

CREATE TABLE skill_ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id    uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  rating      smallint NOT NULL,
  rating_type text NOT NULL CHECK (rating_type IN ('student','team_lead')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_ratings_unique
    UNIQUE (course_id, user_id, skill_id, rating_type)
);

------------------------------------------------------------
-- 6. Work journals, feedback, evaluations, rubric
------------------------------------------------------------

CREATE TABLE work_journals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id           uuid REFERENCES teams(id) ON DELETE SET NULL,
  ta_user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  content           text NOT NULL,
  sentiment_self    smallint NOT NULL,
  sentiment_team    smallint NOT NULL,
  sentiment_course  smallint NOT NULL,
  mood_text         text,
  reach_out_to      text CHECK (reach_out_to IN ('none','professor','ta','team_leader')),
  visibility        text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journal_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES work_journals(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE eval_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  author_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type      text NOT NULL CHECK (subject_type IN ('user','team')),
  subject_id        uuid NOT NULL,
  visibility        text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
  sentiment         smallint,
  body              text NOT NULL,
  type              text NOT NULL DEFAULT 'default' CHECK (type IN ('default','rubric')),
  private_text      text,
  public_text       text,
  independence_score smallint,
  technical_score    smallint,
  teamwork_score     smallint,
  week               smallint,
  is_read           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_rubric_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  item_key   text NOT NULL,  -- 'attendance', 'work_journal', etc.
  label      text NOT NULL,
  enabled    boolean NOT NULL DEFAULT false,
  weight     numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_rubric_items_course_item_unique UNIQUE (course_id, item_key)
);

CREATE TABLE evaluation_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id    uuid REFERENCES teams(id) ON DELETE SET NULL,
  team_role  text,
  week_label text NOT NULL,      -- 'Week 1', 'Week 2', ...
  status     text NOT NULL,      -- 'On Track', 'At Risk', 'Off Track'
  mood       text NOT NULL,      -- 'Green', 'Yellow', 'Red'
  notes      text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_reports_unique
    UNIQUE (course_id, user_id, week_label)
);

------------------------------------------------------------
-- 7. Attendance (codes & marks)
------------------------------------------------------------

CREATE TABLE attendance_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('class','group_meeting','office_hours','class_meeting','code_created')),
  live_minutes int NOT NULL DEFAULT 10,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CONSTRAINT attendance_sessions_code_not_empty CHECK (length(code) > 0)
);

CREATE TABLE attendances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marked_at  timestamptz NOT NULL DEFAULT now(),
  success    boolean NOT NULL DEFAULT true,
  source     text NOT NULL DEFAULT 'self',
  CONSTRAINT attendances_session_user_unique UNIQUE (session_id, user_id)
);

------------------------------------------------------------
-- 8. Task tracker & GitHub
------------------------------------------------------------

CREATE TABLE project_stories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_tasks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  story_id           uuid NOT NULL REFERENCES project_stories(id) ON DELETE CASCADE,
  title              text NOT NULL,
  description        text,
  status             text NOT NULL CHECK (status IN ('todo','progress','done')),
  badge              text,
  due_at             timestamptz,
  assignee_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  position           int NOT NULL DEFAULT 0,
  github_issue_number int,
  github_url         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE github_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  owner         text,  -- Repository owner (optional if using org projects)
  repo          text,  -- Repository name (optional if using org projects)
  token         text NOT NULL,
  project_id    text,  -- GitHub Project v2 ID (optional, direct ID usage)
  org_name      text,  -- Organization name (optional, for org projects)
  project_number int,  -- Project number (optional, for org projects)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_configs_course_unique UNIQUE (course_id)
);

------------------------------------------------------------
-- 9. Helpful indexes
------------------------------------------------------------

CREATE INDEX idx_course_memberships_course
  ON course_memberships (course_id);

CREATE INDEX idx_course_memberships_user
  ON course_memberships (user_id);

CREATE INDEX idx_role_assignments_scope
  ON role_assignments (scope_type, scope_id);

CREATE INDEX idx_teams_course
  ON teams (course_id);

CREATE INDEX idx_team_members_team
  ON team_members (team_id);

CREATE INDEX idx_team_members_user
  ON team_members (user_id);

CREATE INDEX idx_class_events_course
  ON class_events (course_id, due_at);

CREATE INDEX idx_skills_course
  ON skills (course_id);

CREATE INDEX idx_skill_ratings_course_user
  ON skill_ratings (course_id, user_id);

CREATE INDEX idx_work_journals_course_created
  ON work_journals (course_id, created_at DESC);

CREATE INDEX idx_work_journals_user_created
  ON work_journals (user_id, created_at DESC);

CREATE INDEX idx_eval_notes_subject
  ON eval_notes (course_id, subject_type, subject_id);

CREATE INDEX idx_evaluation_reports_course_user
  ON evaluation_reports (course_id, user_id);

CREATE INDEX idx_attendance_sessions_course_code
  ON attendance_sessions (course_id, code);

CREATE INDEX idx_attendances_session
  ON attendances (session_id);

CREATE INDEX idx_project_stories_course
  ON project_stories (course_id);

CREATE INDEX idx_project_tasks_story
  ON project_tasks (story_id);

CREATE INDEX idx_project_tasks_course_status
  ON project_tasks (course_id, status);

------------------------------------------------------------
-- 10. SEED DATA (users, roles, course, team, skills)
------------------------------------------------------------

-- Fixed UUIDs so they are predictable between machines
-- (You must set DEFAULT_COURSE_ID to the course UUID below)

-- Users
INSERT INTO users (id, email, email_verified_at, given_name, family_name, display_name)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'professor@school.edu',     now(), 'Ada',    'Professor', 'Ada Professor'),
  -- ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ta@school.edu',            now(), 'Sam',    'Assistant', 'Sam Assistant'),
  -- ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'student@school.edu',       now(), 'Grace',  'Hopper',    'Grace Hopper'),
  -- ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'teamlead@school.edu',      now(), 'Linus',  'Lead',      'Linus Lead'),
  -- New explicit team lead user (seed)
  -- ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'alex_teamlead@school.edu', now(), 'Alex',  'Lee',       'Alex Lee'),
  -- Admin user for site/course management
  ('99999999-9999-9999-9999-999999999999', 'admin@school.edu',         now(), 'Admin', 'User',      'Site Admin');

-- Roles
INSERT INTO roles (id, key, label)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'professor',  'Professor'),
  ('e2222222-2222-2222-2222-222222222222', 'student',    'Student'),
  ('e3333333-3333-3333-3333-333333333333', 'ta',         'Teaching Assistant'),
  ('e4444444-4444-4444-4444-444444444444', 'tutor',      'Tutor'),
  ('e5555555-5555-5555-5555-555555555555', 'admin',      'Admin'),
  -- New role representing team lead explicitly
  ('e6666666-6666-6666-6666-666666666666', 'team_lead',  'Team Lead');

-- Term
INSERT INTO terms (id, code, name, starts_on, ends_on)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'FA25',
  'Fall 2025',
  DATE '2025-09-22',
  DATE '2025-12-12'
);

-- Course (THIS is your DEFAULT_COURSE_ID)
INSERT INTO courses (id, term_id, code, title, sectioning_mode, settings, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'CSE210',
  'Software Engineering',
  'single',
  '{}'::jsonb,
  now()
);

-- Course info
INSERT INTO course_info (course_id, description, homepage_url, links, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Intro to team-based software engineering with Conductor demo course.',
  'https://example.edu/cse210',
  '[]'::jsonb,
  now()
);

-- Course memberships (everyone in the course)
INSERT INTO course_memberships (id, course_id, user_id, status, created_at)
VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active', now()), -- professor
  -- (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active', now()), -- ta
  -- (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active', now()), -- student
  -- (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'active', now()), -- team lead (Linus, legacy derived)
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'active', now()), -- new explicit team lead (Alex Lee)
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'active', now()); -- admin user

-- Role assignments scoped to this course
INSERT INTO role_assignments (id, user_id, role_id, scope_type, scope_id, created_at)
VALUES
  -- professor@school.edu as professor
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1111111-1111-1111-1111-111111111111', 'course', '22222222-2222-2222-2222-222222222222', now()),
  -- ta@school.edu as TA
  -- (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e3333333-3333-3333-3333-333333333333', 'course', '22222222-2222-2222-2222-222222222222', now()),
  -- -- student@school.edu as student
  -- (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'e2222222-2222-2222-2222-222222222222', 'course', '22222222-2222-2222-2222-222222222222', now()),
  -- -- teamlead@school.edu as student (legacy derived leader)
  -- (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'e2222222-2222-2222-2222-222222222222', 'course', '22222222-2222-2222-2222-222222222222', now()),
  -- alex_teamlead@school.edu as explicit team_lead
  (gen_random_uuid(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'e6666666-6666-6666-6666-666666666666', 'course', '22222222-2222-2222-2222-222222222222', now()),
  -- admin@school.edu as admin for the course
  (gen_random_uuid(), '99999999-9999-9999-9999-999999999999', 'e5555555-5555-5555-5555-555555555555', 'course', '22222222-2222-2222-2222-222222222222', now());

-- One demo team
-- INSERT INTO teams (id, course_id, code, name, display_number, status, description, created_at)
-- VALUES (
--   '33333333-3333-3333-3333-333333333333',
--   '22222222-2222-2222-2222-222222222222',
--   'TEAM-1',
--   'Team 1',
--   '1',
--   'On Track',
--   'Default demo team for the course.',
--   now()
-- );

-- Team members: student + team lead
-- INSERT INTO team_members (id, team_id, user_id, is_leader, joined_at)
-- VALUES
--   (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, now()),
--   (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true,  now());

-- TA assignment to team
-- INSERT INTO team_ta_assignments (id, team_id, ta_user_id, created_at)
-- VALUES (
--   gen_random_uuid(),
--   '33333333-3333-3333-3333-333333333333',
--   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
--   now()
-- );

-- Some initial class events
-- INSERT INTO class_events (id, course_id, created_by, title, description, type, starts_at, due_at, created_at, updated_at)
-- VALUES
--   (
--     gen_random_uuid(),
--     '22222222-2222-2222-2222-222222222222',
--     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
--     'Project Kickoff',
--     'Intro to course and team project.',
--     'Class',
--     now() + interval '1 day',
--     null,
--     now(),
--     now()
--   ),
--   (
--     gen_random_uuid(),
--     '22222222-2222-2222-2222-222222222222',
--     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
--     'Milestone 1',
--     'First project milestone deliverable.',
--     'Assignment',
--     now() + interval '7 days',
--     now() + interval '7 days',
--     now(),
--     now()
--   );

-- Example skills for group formation
-- INSERT INTO skills (id, course_id, name, description, weight, position, created_at, updated_at)
-- VALUES
--   (
--     gen_random_uuid(),
--     '22222222-2222-2222-2222-222222222222',
--     'Frontend (React / JS)',
--     'Comfort building basic UI components and wiring up API calls.',
--     1.50,
--     1,
--     now(),
--     now()
--   ),
--   (
--     gen_random_uuid(),
--     '22222222-2222-2222-2222-222222222222',
--     'Backend (Node / APIs)',
--     'Comfort designing routes, DB queries, and server logic.',
--     1.50,
--     2,
--     now(),
--     now()
--   ),
--   (
--     gen_random_uuid(),
--     '22222222-2222-2222-2222-222222222222',
--     'Collaboration & Communication',
--     'Able to coordinate, document, and help keep the team on track.',
--     1.00,
--     3,
--     now(),
--     now()
--   );

-- Optional: simple rubric items
-- INSERT INTO course_rubric_items (course_id, item_key, label, enabled, weight, updated_at)
-- VALUES
--   ('22222222-2222-2222-2222-222222222222', 'attendance',   'Attendance / Participation', true, 20.00, now()),
--   ('22222222-2222-2222-2222-222222222222', 'work_journal', 'Weekly Work Journal',        true, 30.00, now()),
--   ('22222222-2222-2222-2222-222222222222', 'project',      'Project Contributions',      true, 50.00, now());

-- Optional: one initial evaluation report so student weekly view isn't empty
-- INSERT INTO evaluation_reports (
--   course_id, user_id, team_id, team_role, week_label, status, mood, notes, created_by, created_at, updated_at
-- ) VALUES (
--   '22222222-2222-2222-2222-222222222222',
--   'cccccccc-cccc-cccc-cccc-cccccccccccc',
--   '33333333-3333-3333-3333-333333333333',
--   'Developer',
--   'Week 1',
--   'On Track',
--   'Green',
--   'Good start to the quarter. Keep contributing regularly.',
--   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
--   now(),
--   now()
-- );

-- Done.
-- IMPORTANT for the app:
--   In your .env, set:
--     DATABASE_URL=postgres://<user>:<pass>@localhost:5432/conductor
--     DEFAULT_COURSE_ID=22222222-2222-2222-2222-222222222222
