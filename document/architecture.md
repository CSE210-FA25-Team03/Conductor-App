# Conductor App - System Architecture Diagram

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONDUCTOR APP SYSTEM                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐         ┌──────────────────────────────┐
│      CLIENT LAYER            │         │    SERVER LAYER              │
│    (Frontend - Browser)      │◄───────►│  (Backend - Express.js)      │
│                              │         │                              │
│  ┌────────────────────────┐  │         │  ┌────────────────────────┐ │
│  │   Login Page           │  │         │  │   Express Server       │ │
│  │  ┌──────────────────┐  │  │         │  │  ┌──────────────────┐ │ │
│  │  │ Authentication   │  │  │         │  │  │ Route Handlers   │ │ │
│  │  │ Role Selection   │  │  │         │  │  │ Middleware       │ │ │
│  │  │ Session Init     │  │  │         │  │  │ Request Parser   │ │ │
│  │  └──────────────────┘  │  │         │  │  └──────────────────┘ │ │
│  └────────────────────────┘  │         │  └────────────────────────┘ │
│                              │         │                              │
│  ┌────────────────────────┐  │         │  ┌────────────────────────┐ │
│  │   Dashboard Layer      │  │         │  │   API Routes           │ │
│  │  ┌──────────────────┐  │  │         │  │  ┌──────────────────┐ │ │
│  │  │ Professor Dash   │  │  │         │  │  │ /api/teams       │ │ │
│  │  │ TA Dashboard     │  │  │         │  │  │ /api/evaluations │ │ │
│  │  │ Student Dashboard│  │  │         │  │  │ /api/groups      │ │ │
│  │  │ Team Lead Dash   │  │  │         │  │  │ /api/attendance  │ │ │
│  │  │ Profile Card     │  │  │         │  │  │ /api/classes     │ │ │
│  │  └──────────────────┘  │  │         │  │  └──────────────────┘ │ │
│  └────────────────────────┘  │         │  └────────────────────────┘ │
│                              │         │                              │
│  ┌────────────────────────┐  │         │  ┌────────────────────────┐ │
│  │   Feature Modules      │  │         │  │   Repository Layer     │ │
│  │  ┌──────────────────┐  │  │         │  │  ┌──────────────────┐ │ │
│  │  │ Class Directory  │  │  │         │  │  │ TeamsRepository  │ │ │
│  │  │ Group Formation  │  │  │         │  │  │ Evaluations...   │ │ │
│  │  │ Attendance       │  │  │         │  │  │ Abstract Factory │ │ │
│  │  │ Task Tracker     │  │  │         │  │  └──────────────────┘ │ │
│  │  │ Evaluation       │  │  │         │  └────────────────────────┘ │
│  │  │ Work Journal     │  │  │         │                              │
│  │  │ Team Meeting     │  │  │         │  ┌────────────────────────┐ │
│  │  └──────────────────┘  │  │         │  │   Data Implementations │ │
│  └────────────────────────┘  │         │  │  ┌──────────────────┐ │ │
│                              │         │  │  │ JsonRepository   │ │ │
│  ┌────────────────────────┐  │         │  │  │ PostgresRepo     │ │ │
│  │   Shared Components    │  │         │  │  │ (Plugin)         │ │ │
│  │  ┌──────────────────┐  │  │         │  │  └──────────────────┘ │ │
│  │  │ Header/Nav       │  │  │         │  └────────────────────────┘ │
│  │  │ Profile Dropdown │  │  │         │                              │
│  │  │ Back Button      │  │  │         │  ┌────────────────────────┐ │
│  │  │ Forms            │  │  │         │  │   Data Layer           │ │
│  │  │ Modals           │  │  │         │  │  ┌──────────────────┐ │ │
│  │  │ Buttons          │  │  │         │  │  │ JSON Files       │ │ │
│  │  │ Tables           │  │  │         │  │  │ PostgreSQL DB    │ │ │
│  │  └──────────────────┘  │  │         │  │  │ (Extensible)     │ │ │
│  └────────────────────────┘  │         │  │  └──────────────────┘ │ │
│                              │         │  └────────────────────────┘ │
│  ┌────────────────────────┐  │         │                              │
│  │   Utilities            │  │         │  ┌────────────────────────┐ │
│  │  ┌──────────────────┐  │  │         │  │   Testing            │ │
│  │  │ localStorage     │  │  │         │  │  ┌──────────────────┐ │ │
│  │  │ sessionStorage   │  │  │         │  │  │ Jest Unit Tests  │ │ │
│  │  │ Form Validation  │  │  │         │  │  │ app.test.js      │ │ │
│  │  │ Helpers          │  │  │         │  │  └──────────────────┘ │ │
│  │  └──────────────────┘  │  │         │  └────────────────────────┘ │
│  └────────────────────────┘  │         │                              │
└──────────────────────────────┘         └──────────────────────────────┘

                           ▲
                           │
                    HTTP / REST API
                    JSON Payloads
                           │
                           ▼

        ┌─────────────────────────────────────────────┐
        │    EXTERNAL SERVICES (Future)               │
        │  ┌────────────────────────────────────────┐ │
        │  │ Google Calendar Integration            │ │
        │  │ GitHub API (Team Creation)             │ │
        │  │ Canvas/Blackboard LMS API              │ │
        │  │ Email Service (Notifications)          │ │
        │  └────────────────────────────────────────┘ │
        └─────────────────────────────────────────────┘
```

---

## Detailed Component Architecture

### Frontend Module Structure

```
frontend/
│
├── public/
│   └── index.html ────────────► Redirects to /login
│
├── src/pages/
│   │
│   ├── login_page/
│   │   ├── login.html ────────► Auth UI
│   │   ├── script.js ─────────► Auth logic (role selection)
│   │   └── style.css
│   │
│   ├── dashboards/
│   │   ├── professor.html ────► Staff dashboard view
│   │   ├── ta.html ──────────► TA dashboard view
│   │   ├── student.html ─────► Student dashboard view
│   │   ├── team_lead.html ───► Team lead dashboard view
│   │   ├── script.js ────────► Navigation & panel logic
│   │   ├── student_attendance.js
│   │   └── style.css
│   │
│   ├── class_directory/
│   │   ├── class_directory.html ──► Staff directory UI
│   │   ├── script.js ─────────────► Load/save logic
│   │   └── style.css
│   │
│   ├── class_directory_student/
│   │   ├── class_directory_student.html
│   │   ├── people.html ──────► Student roster view
│   │   ├── calendar.html ────► Event calendar
│   │   ├── people.js
│   │   ├── student.js
│   │   └── student.css
│   │
│   ├── attendance/
│   │   ├── professor_attendance.html ──► Code generation UI
│   │   ├── professor_attendance.js ────► Session logic
│   │   ├── student_attendance.js
│   │   └── professor_attendance.css
│   │
│   ├── group_formation/
│   │   ├── group_formation.html ──────► Group selection UI
│   │   ├── group_formation.js ────────► Main logic
│   │   ├── algorithm.js ──────────────► Grouping algorithm
│   │   ├── group_member_form.html ────► Member form modal
│   │   ├── group_member_form.js
│   │   ├── group_member_form.css
│   │   └── style.css
│   │
│   ├── evaluation_journal/
│   │   ├── evaluation_journal.html ──► Evaluation UI
│   │   ├── script.js
│   │   └── style.css
│   │
│   ├── evaluation_rubric/
│   │   ├── evaluation_rubric.html ──► Rubric config UI
│   │   └── style.css
│   │
│   ├── task_tracker/
│   │   ├── task_tracker.html ──────► GitHub task UI
│   │   ├── script.js
│   │   └── style.css
│   │
│   ├── team_card/
│   │   ├── team_card.html ─────────► Team info display
│   │   └── scripts.js
│   │
│   ├── team_meeting_task/
│   │   ├── team_meeting_task.html ──► Meeting task UI
│   │   └── style.css
│   │
│   ├── work_journal/
│   │   └── (future implementation)
│   │
│   ├── class_config/
│   │   ├── class_config.html ──────► Course settings UI
│   │   ├── script.js
│   │   └── style.css
│   │
│   └── profile_page/
│       ├── profile.html ──────────► User profile UI
│       └── profile.css
│
├── assets/
│   ├── css/
│   │   └── class-directory-nav.css ──► Shared nav styles
│   ├── js/
│   │   └── class-directory-nav.js ───► Shared nav logic
│   └── logo/
│       ├── icons8-google.svg
│       └── user.png
│
└── cypress/ (E2E Testing)
    ├── e2e/
    │   └── dashboard.cy.js ─────► Cypress test specs
    ├── fixtures/
    │   └── example.json
    └── support/
        ├── commands.js
        └── e2e.js
```

---

### Backend Module Structure

```
backend/
│
├── server.js ─────────────────────► Express app entry point
│   ├── Express Config
│   ├── Middleware Setup (JSON parser, static serving)
│   ├── Route Mounting
│   └── Server Listen (PORT 3000)
│
├── repositories/ (Repository Pattern)
│   │
│   ├── repositoryFactory.js ──► Factory for creating repos
│   │
│   ├── TeamsRepository.js ────► Abstract interface
│   │   └── Methods:
│   │       ├── getTeams(classId)
│   │       ├── createTeam(team)
│   │       ├── updateTeam(id, data)
│   │       └── deleteTeam(id)
│   │
│   ├── EvaluationsRepository.js ─► Abstract interface
│   │   └── Methods:
│   │       ├── getEvaluations(memberId)
│   │       ├── createEvaluation(eval)
│   │       ├── updateEvaluation(id, data)
│   │       └── deleteEvaluation(id)
│   │
│   └── implementations/
│       ├── JsonTeamsRepository.js ────► JSON file storage
│       ├── JsonEvaluationsRepository.js
│       └── PostgresTeamsRepository.js ─► PostgreSQL storage
│
├── data/ (Persistent Storage - JSON)
│   ├── teams.json ──────────────► Team data
│   ├── class_directory.json ────► Class info
│   ├── evaluations.json ────────► Student evaluations
│   ├── members.json ────────────► Class members
│   ├── group-formation.json ────► Group assignments
│   ├── class_events.json ───────► Calendar events
│   ├── tasks.json ──────────────► Task tracking
│   └── github-config.json ──────► GitHub integration
│
├── test/
│   └── app.test.js ─────────────► Jest unit tests
│
├── package.json ────────────────► Node dependencies
├── eslint.config.mjs ───────────► Linting rules
├── jsdoc.json ──────────────────► Documentation config
├── README.md ───────────────────► Backend docs
└── .codacy.yml ─────────────────► Code quality config
```

---

## Data Flow Diagrams

### 1. User Authentication Flow

```
┌─────────────┐
│   User      │
│ Enters Cred │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  Login Page                 │
│  ├─ Email Input            │
│  ├─ Password Input          │
│  └─ Role Selector          │
└──────┬──────────────────────┘
       │
       ▼ localStorage.setItem("currentUser", {...})
┌─────────────────────────────┐
│  Browser Storage            │
│  ├─ currentUser obj         │
│  ├─ role                    │
│  ├─ classId                 │
│  └─ sessionId               │
└──────┬──────────────────────┘
       │
       ▼ window.location.href = "/dashboards/{role}.html"
┌─────────────────────────────┐
│  Appropriate Dashboard      │
│  ├─ Verify currentUser      │
│  ├─ Load role-specific UI   │
│  └─ Populate panels         │
└─────────────────────────────┘
```

---

### 2. Class Directory Data Flow

```
Professor/Staff Views Class Directory
                 │
                 ▼
    Click "Open" button on Dashboard
                 │
                 ▼
Navigate to /class_directory/class_directory.html
                 │
                 ▼
    script.js: loadData()
                 │
                 ├─► localStorage.getItem("conductor_class_directory_v1")
                 │   OR
                 │   ├─► POST /api/class-directory/{courseId} (future)
                 │   └─► Response: { courseId, courseName, instructor, teams }
                 │
                 ▼
    Populate Form Fields
    ├─ Course Name & Code
    ├─ Instructor Info
    ├─ Teams List
    └─ Calendar Placeholder
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
   User Makes         Save/Reset/Export
   Changes (Edit)            │
        │                    ▼
        └──────────► localStorage.setItem("conductor_class_directory_v1")
                            OR
                     POST /api/class-directory/{courseId}
                            │
                            ▼
                    ✓ Success Message
```

---

### 3. Group Formation Algorithm Flow

```
Student List (Selected)
        │
        ▼
┌──────────────────────────────────┐
│  Algorithm Input                 │
│  ├─ Members: []                  │
│  ├─ GroupSize: 3                 │
│  ├─ Diversity: true              │
│  └─ SkillBalance: true           │
└──────────┬───────────────────────┘
           │
           ▼ algorithm.js: formGroups()
┌──────────────────────────────────┐
│  Validation Layer                │
│  ├─ Check member count >= 2      │
│  ├─ Validate skill levels        │
│  └─ Check group size constraints │
└──────────┬───────────────────────┘
           │
           ▼ (Valid)
┌──────────────────────────────────┐
│  Sorting Layer                   │
│  ├─ Primary: Skill (H→M→L)       │
│  └─ Secondary: Availability      │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Assignment Layer                │
│  ├─ Pick 1 high-skill student    │
│  ├─ Add medium-skill students    │
│  └─ Fill with low-skill students │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Output                          │
│  ├─ Groups: [{...}, {...}]       │
│  └─ Unassigned: [{...}]          │
└──────────┬───────────────────────┘
           │
           ▼
    Display on Page
        │
    ┌───┴───┐
    ▼       ▼
 [Edit]  [Save]
    │       │
    │       └──► localStorage / API POST
    └──────────► Show form modal
```

---

### 4. Attendance Code Generation & Check-In Flow

```
PROFESSOR SIDE:
───────────────
Set Duration (e.g., 10 min)
        │
        ▼
Click "Generate Code"
        │
        ▼
generateRandomCode() → "A2B3C4"
        │
        ▼
Create Session Object:
{
  id: "CSE210-1673347530000",
  code: "A2B3C4",
  createdAt: "2025-01-10T14:35:30Z",
  expiresAt: "2025-01-10T14:45:30Z"
}
        │
        ▼
attendanceSessions.push(session)
        │
        ▼
Display Code & Expiration Time
        │
        ▼
Update Sessions Table


STUDENT SIDE:
─────────────
See Prompt: "Enter Code"
        │
        ▼
Input "A2B3C4"
        │
        ▼
validateCheckIn()
├─ Check format (6 alphanumeric) ✓
├─ Find active session ✓
└─ Not yet checked in ✓
        │
        ▼
Record Check-In:
{
  sessionId: "CSE210-1673347530000",
  studentId: "STU001",
  checkInTime: "2025-01-10T14:37:15Z"
}
        │
        ▼
attendanceRecords[sessionId][studentId] = checkInTime
        │
        ▼
Display Success Message
✓ You are now marked present


PROFESSOR SEES:
───────────────
Sessions Table Auto-Updates
        │
        ▼
"# Present" count increments (28 → 29)
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                  CONDUCTOR APP TECH STACK                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FRONTEND                          BACKEND                  │
│  ──────────────────────            ───────────────────────  │
│  • HTML5                           • Node.js                │
│  • CSS3                            • Express.js             │
│  • Vanilla JavaScript              • Repository Pattern     │
│  • FullCalendar 6.1.8              • JSON Storage (default) │
│  • Cypress (E2E Testing)           • PostgreSQL (optional)  │
│  • ESLint (Code Quality)           • Jest (Unit Testing)    │
│  • HTMLHint (HTML Linting)         • JSDoc (Documentation) │
│  • Stylelint (CSS Linting)         • ESLint (Code Quality) │
│                                    • Codacy (CI/CD)        │
│                                                              │
│  SHARED / DEVOPS                                            │
│  ────────────────────────────────────────────────────────────
│  • Git/GitHub (Version Control)                            │
│  • JSON (Data Format)                                      │
│  • REST API (Communication)                                │
│  • npm (Package Management)                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## API Route Mapping

```
Frontend Requests                Backend Response
────────────────────────────────────────────────────────────

GET /login                    ──► login.html
GET /dashboards/:role         ──► {role}.html
GET /class_directory          ──► class_directory.html
GET /attendance               ──► professor_attendance.html
GET /group_formation          ──► group_formation.html
GET /profile_page             ──► profile.html
GET /evaluation_journal       ──► evaluation_journal.html
GET /evaluation_rubric        ──► evaluation_rubric.html
GET /task_tracker             ──► task_tracker.html
GET /team_card                ──► team_card.html

API Routes (Data)
─────────────────
GET /api/teams                ──► { teams: [] }
POST /api/teams               ──► { success, teamId }
PUT /api/teams/:id            ──► { success }
DELETE /api/teams/:id         ──► { success }

GET /api/evaluations/:memberId ──► { evaluations: [] }
POST /api/evaluations         ──► { success }
PUT /api/evaluations/:id      ──► { success }

GET /api/classes/:classId/members ──► { members: [] }
GET /api/class-directory/:courseId ──► { course, instructor, teams }
POST /api/class-directory/:courseId ──► { success }

GET /api/attendance/sessions/:classId ──► { sessions: [] }
POST /api/attendance/session  ──► { success, sessionId }
POST /api/attendance/check-in ──► { success }

GET /api/groups/:classId      ──► { groups: [] }
POST /api/groups/generate     ──► { groups, unassigned }
POST /api/groups              ──► { success, groupIds }

Static Assets
─────────────
GET /assets/css/*             ──► CSS files
GET /assets/js/*              ──► JS files
GET /assets/logo/*            ──► Image files
```

---

## User Role & Permission Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    ROLE-BASED ACCESS CONTROL                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  PROFESSOR                   TA (Teaching Assistant)         │
│  ────────────                ──────────────────────          │
│  Dashboard: professor.html    Dashboard: ta.html             │
│  ✅ Create classes          ✅ View class info              │
│  ✅ Generate codes          ✅ Check attendance             │
│  ✅ View attendance         ✅ Grade assignments            │
│  ✅ Create groups           ⚠️  Manage groups (limited)     │
│  ✅ Set rubric              ❌ Create new classes           │
│  ✅ View evaluations        ✅ View evaluations            │
│  ✅ Export reports          ✅ Export reports              │
│                                                              │
│  STUDENT                     TEAM LEAD                       │
│  ────────                    ──────────                      │
│  Dashboard: student.html     Dashboard: team_lead.html      │
│  ✅ View class info          ✅ View team info              │
│  ✅ Check in (attendance)    ✅ Manage team tasks          │
│  ✅ Submit work              ✅ View evaluations (own)      │
│  ✅ View grades              ✅ Track meetings              │
│  ❌ Create classes           ❌ Create new groups          │
│  ❌ Grade others             ⚠️  Limited export             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Schema (JSON Structure)

```
┌─────────────────────────────────────────────────────────┐
│              DATA MODELS (JSON Files)                    │
├─────────────────────────────────────────────────────────┤

teams.json
──────────
[
  {
    id: "T001",
    name: "Team Alpha",
    classId: "CSE210",
    members: ["STU001", "STU002", "STU003"],
    leader: "STU001",
    createdAt: "2025-01-01T10:00:00Z"
  }
]

members.json
────────────
[
  {
    id: "STU001",
    name: "Alice Smith",
    email: "alice@school.edu",
    role: "Student",
    classId: "CSE210",
    skill: "High",
    availability: "MWF 10am-12pm"
  }
]

evaluations.json
────────────────
[
  {
    id: "EVAL001",
    studentId: "STU001",
    classId: "CSE210",
    attendance: 95,
    participation: 88,
    submission: 92,
    workJournal: 85,
    evaluationJournal: 90,
    score: 90,
    feedback: "Excellent work"
  }
]

class_directory.json
────────────────────
[
  {
    courseId: "CSE210",
    courseName: "Design of Usable Interactive Systems",
    term: "FA25",
    instructor: {
      name: "Dr. Smith",
      email: "smith@school.edu",
      pronouns: "he/him"
    },
    tas: [],
    tutors: [],
    teams: []
  }
]

group-formation.json
────────────────────
[
  {
    groupId: "G001",
    classId: "CSE210",
    groupName: "Team A",
    members: ["STU001", "STU002", "STU003"],
    createdAt: "2025-01-10T14:35:30Z"
  }
]

class_events.json
──────────────────
[
  {
    id: "EVT001",
    classId: "CSE210",
    title: "HW3 Due",
    type: "Assignment",
    dueDate: "2025-01-15T23:59:59Z",
    description: "Submit design mockups"
  }
]

tasks.json
──────────
[
  {
    id: "TSK001",
    teamId: "T001",
    title: "Setup GitHub repo",
    status: "In Progress",
    assignedTo: "STU001",
    dueDate: "2025-01-12"
  }
]

github-config.json
──────────────────
[
  {
    classId: "CSE210",
    orgName: "cse210-fa25",
    teams: {
      T001: "team-alpha",
      T002: "team-beta"
    }
  }
]

└─────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌────────────────────────────────────────────────────────┐
│            DEPLOYMENT ENVIRONMENT                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  DEVELOPMENT                                          │
│  ────────────                                         │
│  localhost:3000                                       │
│  ├─ Express Server (npm start)                       │
│  ├─ Frontend (served as static)                      │
│  └─ JSON files (local /data dir)                     │
│                                                        │
│  TESTING                                              │
│  ───────                                              │
│  ├─ Jest Unit Tests (backend)                        │
│  │  └─ npm test                                       │
│  ├─ Cypress E2E Tests (frontend)                     │
│  │  └─ npm run cypress                                │
│  ├─ ESLint & Codacy (code quality)                   │
│  │  └─ npm run lint                                   │
│  └─ HTMLHint & Stylelint                             │
│     └─ npm run lint:frontend                         │
│                                                        │
│  PRODUCTION (Future)                                  │
│  ──────────────────                                   │
│  ├─ Cloud Server (AWS/Azure/Heroku)                  │
│  ├─ PostgreSQL Database                              │
│  ├─ CI/CD Pipeline (GitHub Actions)                  │
│  ├─ SSL/TLS (HTTPS)                                  │
│  └─ Logging & Monitoring                             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## File Request Routing

```
Browser Request                Server Response
────────────────────────────────────────────────

http://localhost:3000/
    └─ Redirects to /login (index.html meta refresh)

http://localhost:3000/login
    └─ Serves: /frontend/src/pages/login_page/login.html

http://localhost:3000/dashboards/professor
    └─ Serves: /frontend/src/pages/dashboards/professor.html

http://localhost:3000/class_directory
    └─ Serves: /frontend/src/pages/class_directory/class_directory.html

http://localhost:3000/attendance
    └─ Serves: /frontend/src/pages/attendance/professor_attendance.html

http://localhost:3000/group_formation
    └─ Serves: /frontend/src/pages/group_formation/group_formation.html

http://localhost:3000/assets/css/class-directory-nav.css
    └─ Serves: /frontend/assets/css/class-directory-nav.css

http://localhost:3000/api/teams
    └─ Routes to: TeamsRepository methods
         └─ Data from: /backend/data/teams.json
```

---

## Development Workflow

```
┌──────────────────────────────────────────────────────┐
│              DEVELOPMENT WORKFLOW                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. START SERVER                                    │
│     cd backend && npm install && npm start          │
│     └─ Listens on http://localhost:3000             │
│                                                      │
│  2. OPEN IN BROWSER                                 │
│     http://localhost:3000/login                     │
│     └─ Select role (Professor/Student/TA)          │
│                                                      │
│  3. NAVIGATE DASHBOARDS                             │
│     Click cards to access features:                 │
│     ├─ Class Directory                              │
│     ├─ Group Formation                              │
│     ├─ Attendance                                   │
│     ├─ Evaluation                                   │
│     └─ Task Tracker                                 │
│                                                      │
│  4. TEST FEATURES                                   │
│     • Check browser console (F12) for errors       │
│     • Check Network tab for API calls              │
│     • Verify data persists in localStorage         │
│                                                      │
│  5. RUN TESTS                                       │
│     Backend:  cd backend && npm test               │
│     Frontend: cd frontend && npm run cypress       │
│                                                      │
│  6. LINT CODE                                       │
│     eslint . (JavaScript)                          │
│     htmlhint . (HTML)                              │
│     stylelint . (CSS)                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Integration Points & Dependencies

```
External Service Dependencies
─────────────────────────────

FullCalendar 6.1.8
    └─ Used in: class_directory.html, class_directory_student
    └─ NPM: npm install @fullcalendar/core

Google Icons
    └─ Used in: assets/logo/icons8-google.svg
    └─ Future: Google Calendar integration

GitHub API (Future)
    └─ Planned for: task_tracker
    └─ Purpose: Sync GitHub issues to task list

Canvas/Blackboard API (Future)
    └─ Planned for: LMS integration
    └─ Purpose: Grade sync, roster import

Email Service (Future)
    └─ Planned for: Notifications
    └─ Purpose: Attendance alerts, group assignments
```


