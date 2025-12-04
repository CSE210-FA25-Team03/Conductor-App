# Attendance System Design Document

## Overview
This document outlines the design for an enhanced attendance system that supports weekly attendance submissions, updates, and comprehensive analytics for teams and the entire class.

## Current State Analysis

### Existing Infrastructure
- **Database Schema**: 
  - `attendance_sessions` table with types: `'class'`, `'group_meeting'`, `'office_hours'`, `'class_meeting'`, `'code_created'`
  - `attendances` table linking users to sessions
  - Current system uses code-based attendance (professor generates codes, students enter them)

### Current Limitations
- No weekly attendance submission form (as shown in screenshot)
- No update/edit capability for attendance
- No team-based or class-wide analytics/visualizations
- No time-series plotting of attendance rates

## Requirements

### Functional Requirements

1. **Weekly Attendance Submission Form**
   - Available to: **Team Lead** and **Student** roles
   - NOT available to: **TA** role
   - Form fields (checkboxes):
     - Class
     - Group Meeting
     - Office Hours
     - Class Meeting
   - Should allow saving and updating submissions
   - Should display "Past Submissions" section

2. **Update Capability**
   - Users should be able to edit/update their weekly attendance submissions
   - Updates should be tracked (timestamp of last update)

3. **Team-Based Overview**
   - Show attendance percentage for each team
   - Plot attendance rate over time (time-series chart)
   - Available to all roles (Professor, TA, Team Lead, Student)

4. **Class Overview**
   - Show overall class attendance percentage
   - Plot class attendance rate over time (time-series chart)
   - Available to all roles

5. **Time-Series Visualization**
   - Display attendance rates as: "Nov 2nd, 70%; Nov 4th, 80%..."
   - Both team-level and class-level views

### Design Question
**Q: For team-based overview, should we plot only lecture attendance or all attendance types?**

**Recommendation**: Plot **all attendance types** for the following reasons:
- Provides comprehensive view of team engagement
- Different attendance types (Class, Group Meeting, Office Hours, Class Meeting) all contribute to student success
- Allows identification of patterns (e.g., team attends class but misses group meetings)
- More actionable insights for instructors

**Alternative**: If preferred, we can add a filter/toggle to switch between:
- "All Attendance Types" (default)
- "Lecture Only" (Class + Class Meeting)

## Database Design

### IMPORTANT: Design Correction

**Original Design (INCORRECT):**
- Users selected attendance types for a period (checkboxes)
- Stored: period_start_date, period_end_date, attendance_types (boolean flags)

**Corrected Design:**
- Users record **actual dates** they attended
- Store: individual records with `attendance_date + attendance_type`
- **Calculate** which 7-day period each date falls into for visualization
- **Aggregate** by calculated period for plotting

See `attendance_system_design_corrected.md` for the revised design.

### New Table: `attendance_records` (CORRECTED)

```sql
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,  -- Actual date of attendance (e.g., 2025-11-02)
  attendance_type text NOT NULL CHECK (attendance_type IN ('class', 'group_meeting', 'office_hours', 'class_meeting')),
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT attendance_records_unique 
    UNIQUE (course_id, user_id, attendance_date, attendance_type)
);
```

**Period Calculation:**
- Periods are calculated from dates: Nov 2 → Period Nov 1-7, Nov 9 → Period Nov 8-14
- Done in queries/backend, not stored in database
- See `get_period_start()` function in migration

### Legacy Table: `weekly_attendance_submissions` (DEPRECATED)

The existing `weekly_attendance_submissions` table uses the old design. 
For new implementation, use `attendance_records` instead.

### New Table: `attendance_update_notifications`

```sql
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
```

### New Table: `weekly_attendance_submissions`

```sql
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
```

### Rationale
- **period_start_date & period_end_date**: Flexible 7-day periods (not ISO weeks). Example: Nov 1-7, Nov 8-15
- **period_label**: Optional human-readable label (e.g., "Nov 1-7", "Week 8")
- **attendance_types (JSONB)**: Flexible schema to support adding new attendance types without schema changes
- **Unique constraint**: One submission per user per period per course
- **Timestamps**: Track creation and updates for audit trail
- **Constraints**: Ensure period is exactly 7 days (inclusive: start + 6 days = end)

### Alternative: Separate Attendance Types Table
**Not chosen** because:
- JSONB provides flexibility for future types
- Simpler queries for current use case
- PostgreSQL JSONB is well-optimized
- Can migrate to separate table later if needed

### Alternative: Reuse Existing `attendance_sessions` Table
**Not recommended** because:
- Current system is code-based and session-based (one code = one session)
- Weekly submissions are different: user self-reports multiple types for a week
- Would require significant schema changes to existing system
- Mixing two different attendance paradigms would be confusing

## API Design

### Endpoints

#### 1. Submit/Update Weekly Attendance
```
POST /api/attendance/weekly/submit
PUT  /api/attendance/weekly/submit
```

**Request Body:**
```json
{
  "periodStartDate": "2025-11-01",  // Start of 7-day period
  "periodEndDate": "2025-11-07",    // End of 7-day period (exactly 7 days)
  "periodLabel": "Nov 1-7",          // Optional
  "attendanceTypes": {
    "class": true,
    "group_meeting": true,
    "office_hours": false,
    "class_meeting": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "submission": {
    "id": "uuid",
    "periodStartDate": "2025-11-01",
    "periodEndDate": "2025-11-07",
    "periodLabel": "Nov 1-7",
    "attendanceTypes": {
      "class": true,
      "group_meeting": true,
      "office_hours": false,
      "class_meeting": true
    },
    "createdAt": "2025-11-03T10:00:00Z",
    "updatedAt": "2025-11-03T10:00:00Z",
    "isUpdate": false,  // true if this was an update to existing submission
    "updateDeadline": "2025-11-09T23:59:59Z"  // 2 days after period end
  },
  "notificationSent": true  // true if team lead was notified (for updates)
}
```

**Update Window Rules:**
- Submissions can be updated within **2 days** after the period end date
- After 2 days, updates are blocked (or require special permission)
- When a student updates attendance, their team lead is automatically notified

#### 2. Get User's Weekly Attendance Submissions
```
GET /api/attendance/weekly/user?periodStartDate=2025-11-01
GET /api/attendance/weekly/user/history
```

**Response:**
```json
{
  "submissions": [
    {
      "id": "uuid",
      "periodStartDate": "2025-11-01",
      "periodEndDate": "2025-11-07",
      "periodLabel": "Nov 1-7",
      "attendanceTypes": {
        "class": true,
        "group_meeting": true,
        "office_hours": false,
        "class_meeting": true
      },
      "createdAt": "2025-11-03T10:00:00Z",
      "updatedAt": "2025-11-03T10:00:00Z",
      "canUpdate": true,  // false if update window (2 days) has passed
      "updateDeadline": "2025-11-09T23:59:59Z"
    }
  ]
}
```

#### 2b. Get Team Lead Notifications
```
GET /api/attendance/weekly/notifications
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "studentName": "John Doe",
      "studentEmail": "john@school.edu",
      "teamName": "Team 1",
      "periodStartDate": "2025-11-01",
      "periodEndDate": "2025-11-07",
      "periodLabel": "Nov 1-7",
      "updatedAt": "2025-11-05T14:30:00Z",
      "notificationSentAt": "2025-11-05T14:30:00Z",
      "isRead": false,
      "submissionId": "uuid"
    }
  ],
  "unreadCount": 2
}
```

#### 3. Get Team Attendance Overview
```
GET /api/attendance/weekly/team/{teamId}?startDate=2025-09-01&endDate=2025-12-15
```

**Response:**
```json
{
  "teamId": "uuid",
  "teamName": "Team 1",
  "overview": {
    "totalPeriods": 12,
    "averageAttendanceRate": 0.85,
    "currentPeriodRate": 0.90
  },
  "timeSeries": [
    {
      "periodStartDate": "2025-11-01",
      "periodEndDate": "2025-11-07",
      "periodLabel": "Nov 1-7",
      "attendanceRate": 0.80,
      "totalMembers": 5,
      "attendedCount": 4,
      "breakdown": {
        "class": 4,
        "group_meeting": 3,
        "office_hours": 2,
        "class_meeting": 4
      }
    },
    {
      "periodStartDate": "2025-11-08",
      "periodEndDate": "2025-11-15",
      "periodLabel": "Nov 8-15",
      "attendanceRate": 0.70,
      "totalMembers": 5,
      "attendedCount": 3,
      "breakdown": {
        "class": 4,
        "group_meeting": 2,
        "office_hours": 1,
        "class_meeting": 3
      }
    }
  ],
  "memberDetails": [
    {
      "userId": "uuid",
      "name": "John Doe",
      "attendanceRate": 0.90,
      "periodsAttended": 11,
      "totalPeriods": 12
    }
  ]
}
```

#### 4. Get Class Attendance Overview
```
GET /api/attendance/weekly/class?startDate=2025-09-01&endDate=2025-12-15
```

**Response:**
```json
{
  "overview": {
    "totalStudents": 50,
    "totalPeriods": 12,
    "averageAttendanceRate": 0.82,
    "currentPeriodRate": 0.85
  },
  "timeSeries": [
    {
      "periodStartDate": "2025-11-01",
      "periodEndDate": "2025-11-07",
      "periodLabel": "Nov 1-7",
      "attendanceRate": 0.80,
      "totalStudents": 50,
      "attendedCount": 40,
      "breakdown": {
        "class": 45,
        "group_meeting": 35,
        "office_hours": 20,
        "class_meeting": 42
      }
    },
    {
      "periodStartDate": "2025-11-08",
      "periodEndDate": "2025-11-15",
      "periodLabel": "Nov 8-15",
      "attendanceRate": 0.70,
      "totalStudents": 50,
      "attendedCount": 35,
      "breakdown": {
        "class": 42,
        "group_meeting": 30,
        "office_hours": 18,
        "class_meeting": 38
      }
    }
  ],
  "teamBreakdown": [
    {
      "teamId": "uuid",
      "teamName": "Team 1",
      "attendanceRate": 0.85,
      "memberCount": 5
    }
  ]
}
```

### Attendance Rate Calculation

**For a single user in a period:**
- Count how many attendance types they marked as `true` in `attendance_types` JSONB
- Divide by total possible types (currently 4: class, group_meeting, office_hours, class_meeting)
- Example: If user attended Class and Group Meeting: 2/4 = 0.50 (50%)
- **Missing submission**: If no submission exists for a period, count as 0% (0/4 = 0%)

**For a team in a period:**
- For each team member, calculate their period rate (as above)
  - If member has no submission, their rate is 0%
- Average all team members' rates
- Example: Team of 3 with rates [0.75, 1.0, 0.00] (third member missing) → (0.75 + 1.0 + 0.00) / 3 = 0.583 (58.3%)

**For the class in a period:**
- For each student in the course, calculate their period rate
  - If student has no submission, their rate is 0%
- Average all students' rates
- Example: 50 students, 40 submitted with average 0.80, 10 missing (0%) → (40×0.80 + 10×0.00) / 50 = 0.64 (64%)

**Time-Series Plotting:**
- Basic unit is **7-day periods** (not calendar weeks)
- Example periods: Nov 1-7 (80%), Nov 8-15 (70%)
- X-axis shows period labels: "Nov 1-7", "Nov 8-15", etc.
- Y-axis shows attendance rate (0-100%)

## Frontend Design

### 1. Weekly Attendance Submission Form

**Location**: Dashboard pages for **Student** and **Team Lead** roles

**UI Components:**
- Modal/Drawer (as shown in screenshot)
- Header: "Attendance Submission" → "Weekly Attendance"
- Instruction text: "Select attendance types for this week and save."
- Checkboxes:
  - ☐ Class
  - ☐ Group Meeting
  - ☐ Office Hours
  - ☐ Class Meeting
- "Save Attendance" button
- "Past Submissions" section (collapsible list)

**Behavior:**
- On open, load current period's submission (if exists) and pre-fill checkboxes
- Allow updates: if submission exists, update it; otherwise create new
- **Update window**: Show warning if trying to update after 2-day deadline
- Show success message on save
- Display past submissions in reverse chronological order
- Show period labels (e.g., "Nov 1-7", "Nov 8-15")

### 2. Team Attendance Overview

**Location**: Dashboard pages for **all roles**

**UI Components:**
- Card/Section: "Team Attendance Overview"
- Summary metrics:
  - Current week attendance rate: "85%"
  - Average attendance rate: "82%"
  - Total weeks tracked: "12"
- Time-series line chart:
  - X-axis: Period labels (Nov 1-7, Nov 8-15, ...)
  - Y-axis: Attendance rate (0-100%)
  - Tooltip: Show exact percentage, period dates, and breakdown on hover
- Optional: Filter by attendance type (All / Lecture Only)

**For Team Lead/Student:**
- Show their team's attendance
- Link to detailed team view

**For TA:**
- Show attendance for teams they're assigned to
- Option to view all teams

**For Professor:**
- Show all teams
- Option to drill down into specific team

### 3. Class Attendance Overview

**Location**: Dashboard pages for **all roles**

**UI Components:**
- Card/Section: "Class Attendance Overview"
- Summary metrics:
  - Current week attendance rate: "80%"
  - Average attendance rate: "78%"
  - Total students: "50"
- Time-series line chart:
  - X-axis: Period labels (Nov 1-7, Nov 8-15, ...)
  - Y-axis: Attendance rate (0-100%)
  - Tooltip: Show exact percentage, period dates, and student count on hover
- Team breakdown table:
  - Team Name | Attendance Rate | Member Count
  - Sortable columns

### 4. Visualization Library

**Recommendation**: Use **Chart.js** or **Recharts** (if React) or **D3.js** for more control

**Chart Type**: Line chart with:
- Smooth curves
- Point markers
- Interactive tooltips
- Responsive design

## Implementation Plan

### Phase 1: Database & Backend
1. Create `weekly_attendance_submissions` table
2. Create `attendance_update_notifications` table
3. Implement backend functions:
   - `submitWeeklyAttendance()` (with 2-day update window validation)
   - `getUserWeeklyAttendance()`
   - `getTeamAttendanceOverview()` (with missing = 0% calculation)
   - `getClassAttendanceOverview()` (with missing = 0% calculation)
   - `notifyTeamLeadOnUpdate()` (notification system)
   - `getTeamLeadNotifications()`
4. Create API endpoints
5. Add validation and error handling
6. Implement 7-day period calculation utilities

### Phase 2: Frontend - Submission Form
1. Create weekly attendance submission component
2. Add to Student and Team Lead dashboards
3. Implement form logic (load, save, update)
4. Add 2-day update window validation and warnings
5. Add "Past Submissions" display with period labels
6. Ensure TA role does NOT see this form
7. Implement notification system for team leads

### Phase 3: Frontend - Analytics
1. Create team attendance overview component
2. Create class attendance overview component
3. Integrate charting library
4. Add time-series visualizations with 7-day period labels
5. Add filters and drill-down capabilities
6. Ensure missing submissions are calculated as 0%

### Phase 4: Testing & Refinement
1. Test all user roles and permissions
2. Test update functionality
3. Test analytics calculations
4. Performance optimization for large datasets
5. UI/UX polish

## Security & Permissions

### Access Control
- **Weekly Submission Form**: Only Student and Team Lead roles
- **Team Overview**: All roles (filtered by team assignment for TA)
- **Class Overview**: All roles (full view for Professor, filtered for others)

### Data Validation
- Ensure `period_start_date` and `period_end_date` represent exactly 7 days (inclusive)
- Validate `attendance_types` JSONB structure
- Ensure user belongs to course before allowing submission
- Ensure team membership for team-specific queries
- Validate 2-day update window (block updates after deadline)
- Ensure period dates are valid (end >= start, exactly 6 days difference)

## Edge Cases & Considerations

1. **Period Boundaries**: Use flexible 7-day periods (not ISO weeks). Example: Nov 1-7, Nov 8-15
2. **Missing Submissions**: **Count as 0% attendance** for that period in all calculations
3. **Update Window**: Submissions can be updated within **2 days** after period end date
4. **Late Submissions**: Allow submissions for past periods (with visual indicator and update window check)
5. **Multiple Teams**: If user is in multiple teams, show attendance for all teams
6. **Team Changes**: If user changes teams mid-semester, maintain historical data
7. **Team Lead Notifications**: When student updates attendance, notify their team lead (if team lead exists)
8. **Performance**: For large classes (100+ students), consider pagination or aggregation strategies
9. **Future Attendance Types**: JSONB schema allows adding new types without migration (e.g., "lab_session", "review_session")
10. **Period Calculation**: Need utility functions to calculate 7-day periods from any date

## Future Enhancements (Out of Scope)

1. Email reminders for missing submissions
2. Attendance trends analysis (predictive)
3. Export attendance data (CSV/Excel)
4. Integration with existing code-based attendance system
5. Mobile app support
6. Attendance goals/targets per team

## Stakeholder Decisions (Confirmed)

1. **Period Definition**: ✅ Use flexible 7-day periods (not ISO weeks). Example: Nov 1-7 (80%), Nov 8-15 (70%)
2. **Missing Submissions**: ✅ Count as 0% in all calculations
3. **Historical Data**: ✅ No migration of existing code-based attendance
4. **Attendance Types**: ✅ Might add more types in the future (schema uses JSONB for flexibility)
5. **Update Window**: ✅ Two days after period end date. When student updates, team lead should be notified

## Implementation Notes

### Period Calculation
- Need utility function to calculate 7-day periods from any date
- Example: Given date Nov 5, 2025 → period is Nov 1-7, 2025
- Periods can start on any day of the week (not restricted to Monday)

### Notification System
- When student updates attendance (not initial submission), create notification record
- Team lead sees notification in their dashboard
- Notification includes: student name, period, update timestamp
- Mark as read when team lead views it

### JSONB Attendance Types Structure
```json
{
  "class": true,
  "group_meeting": true,
  "office_hours": false,
  "class_meeting": true
}
```
- Easy to add new types: `"lab_session": true`
- Query using PostgreSQL JSONB operators: `attendance_types->>'class' = 'true'`

