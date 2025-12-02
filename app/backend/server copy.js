// backend/server.js
require('dotenv').config();

const path = require('path');
const express = require('express');

const groupFormationDb = require('./db/groupFormation');
const teamsDb = require('./db/teams');
const evaluationsDb = require('./db/evaluations');
const classDirectoryDb = require('./db/classDirectory');
const eventsDb = require('./db/events');
const membersDb = require('./db/members');
const tasksDb = require('./db/tasks');
const githubDb = require('./db/github');
const workJournalsDb = require('./db/workJournals');
const attendanceDb = require('./db/attendance');
const rubricDb = require('./db/rubric');
const evalNotesDb = require('./db/evalNotes');
const journalRepliesDb = require('./db/journalReplies');



// NEW: work journals + attendance DB modules (we'll implement these next)
const workJournalsDb = require('./db/workJournals');
const attendanceDb = require('./db/attendance');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------
// Configuration flags
// ------------------------------------------------------------

// DB is considered "configured" if we at least have a DATABASE_URL.
// Some routes ALSO need DEFAULT_COURSE_ID (course-scoped data).
const hasDbConfig = !!process.env.DATABASE_URL;
const hasCourseConfig = !!process.env.DEFAULT_COURSE_ID;
const DEFAULT_COURSE_ID = process.env.DEFAULT_COURSE_ID || null;

// Safe fetch wrapper for GitHub integration.
// Requires Node 18+ (global fetch). If not available, we throw a clear error.
const fetch =
  global.fetch ||
  (() => {
    throw new Error(
      'Global fetch is not available. Run on Node 18+ or add a fetch polyfill (e.g. node-fetch).',
    );
  });

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
app.use(express.json());

// Serve base public assets
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

// Serve static files for each role/page
app.use('/login_page', express.static(path.join(__dirname, '../frontend/src/pages/login_page')));
app.use(
  '/login',
  express.static(path.join(__dirname, '../frontend/src/pages/login_page'), {
    index: 'login.html',
  }),
);
app.get('/login/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/login_page/login.html'));
});

app.use('/team_card', express.static(path.join(__dirname, '../frontend/src/pages/team_card')));
app.use('/new_user', express.static(path.join(__dirname, '../frontend/src/pages/new_user')));
app.use('/task_tracker', express.static(path.join(__dirname, '../frontend/src/pages/task_tracker')));
app.use('/tutor', express.static(path.join(__dirname, '../frontend/src/pages/tutor')));
app.use('/dashboards', express.static(path.join(__dirname, '../frontend/src/pages/dashboards')));
app.use('/profile_page', express.static(path.join(__dirname, '../frontend/src/pages/profile_page')));
app.use('/work_journal', express.static(path.join(__dirname, '../frontend/src/pages/work_journal')));
app.use(
  '/group_formation',
  express.static(path.join(__dirname, '../frontend/src/pages/group_formation')),
);

app.use('/group_formation/student_group_form.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, '../frontend/src/pages/group_formation/student_group_form.html'),
  );
});

app.use('/group_formation/team_lead_group_form.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, '../frontend/src/pages/group_formation/team_lead_group_form.html'),
  );
});

app.use(
  '/evaluation_journal',
  express.static(path.join(__dirname, '../frontend/src/pages/evaluation_journal')),
);
app.use('/class_config', express.static(path.join(__dirname, '../frontend/src/pages/class_config')));
app.use('/attendance', express.static(path.join(__dirname, '../frontend/src/pages/attendance')));
app.use(
  '/class_directory',
  express.static(path.join(__dirname, '../frontend/src/pages/class_directory')),
);
app.use(
  '/team_meeting_task',
  express.static(path.join(__dirname, '../frontend/src/pages/team_meeting_task')),
);

app.use(
  '/class_directory_student',
  express.static(path.join(__dirname, '../frontend/src/pages/class_directory_student'), {
    index: 'class_directory_student.html',
  }),
);
app.get('/class_directory_student/', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      '../frontend/src/pages/class_directory_student/class_directory_student.html',
    ),
  );
});

app.use(
  '/evaluation_rubric',
  express.static(path.join(__dirname, '../frontend/src/pages/evaluation_rubric')),
);

// ------------------------------------------------------------
// Health check
// ------------------------------------------------------------
function healthCheck(_req, res) {
  res.json({ status: 'ok' });
}

app.get('/api/health', healthCheck);

// ------------------------------------------------------------
// Helper: ensure DB config for routes that require it
// ------------------------------------------------------------

/**
 * For routes that need a DB connection.
 * - If DB is not configured at all -> 500 error.
 * - Course-scoped routes should also check hasCourseConfig or DEFAULT_COURSE_ID.
 *
 * Returns true if DB is available, false if it already responded with an error.
 */
function ensureDb(res, { requireCourse = false, errorOnMissingCourse = true } = {}) {
  if (!hasDbConfig) {
    res.status(500).json({ error: 'Database not configured' });
    return false;
  }
  if (requireCourse && !hasCourseConfig) {
    if (errorOnMissingCourse) {
      res.status(500).json({ error: 'Course not configured' });
    }
    return false;
  }
  return true;
}

// ------------------------------------------------------------
// Group Formation API (skills + ratings)
// ------------------------------------------------------------

// GET skills
app.get('/api/group-formation/skills', async (req, res) => {
  try {
    // Read-only: if course missing, return empty list instead of 500
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }
    const skills = await groupFormationDb.getSkills(DEFAULT_COURSE_ID);
    res.json(skills);
  } catch (error) {
    console.error('Error loading skills:', error);
    res.status(500).json({ error: 'Failed to load skills' });
  }
});

// POST (create/update) a skill
app.post('/api/group-formation/skills', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return; // ensureDb already responded with 500
    }
    const skill = await groupFormationDb.upsertSkill(DEFAULT_COURSE_ID, req.body);
    res.status(201).json(skill);
  } catch (error) {
    console.error('Error saving skill:', error);
    res.status(500).json({ error: 'Failed to save skill' });
  }
});

// GET student ratings
app.get('/api/group-formation/student-ratings', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }
    const ratings = await groupFormationDb.getStudentRatings(DEFAULT_COURSE_ID);
    res.json(ratings);
  } catch (error) {
    console.error('Error loading student ratings:', error);
    res.status(500).json({ error: 'Failed to load student ratings' });
  }
});

// POST student ratings
app.post('/api/group-formation/student-ratings', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }
    const { userId, skillRatings } = req.body;
    await groupFormationDb.upsertStudentRating(DEFAULT_COURSE_ID, { userId, skillRatings });
    res.json({ message: 'Student rating saved' });
  } catch (error) {
    console.error('Error saving student rating:', error);
    res.status(500).json({ error: 'Failed to save student rating' });
  }
});

// GET team lead ratings
app.get('/api/group-formation/team-lead-ratings', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }
    const ratings = await groupFormationDb.getTeamLeadRatings(DEFAULT_COURSE_ID);
    res.json(ratings);
  } catch (error) {
    console.error('Error loading team lead ratings:', error);
    res.status(500).json({ error: 'Failed to load team lead ratings' });
  }
});

// POST team lead ratings
app.post('/api/group-formation/team-lead-ratings', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }
    const { userId, skillRatings } = req.body;
    await groupFormationDb.upsertTeamLeadRating(DEFAULT_COURSE_ID, { userId, skillRatings });
    res.json({ message: 'Team lead rating saved' });
  } catch (error) {
    console.error('Error saving team lead rating:', error);
    res.status(500).json({ error: 'Failed to save team lead rating' });
  }
});

// ------------------------------------------------------------
// Teams API
// ------------------------------------------------------------

// GET all teams
app.get('/api/teams', async (req, res) => {
  try {
    // Read-only: if course missing, return empty list
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }
    const teams = await teamsDb.getAllTeams(DEFAULT_COURSE_ID);
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET single team by ID
app.get('/api/teams/:id', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }
    const teamId = req.params.id;
    const team = await teamsDb.getTeamById(teamId, DEFAULT_COURSE_ID);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// CREATE team
app.post('/api/teams', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }
    const newTeam = await teamsDb.createTeam(DEFAULT_COURSE_ID, req.body);
    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// UPDATE team
app.put('/api/teams/:id', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }
    const teamId = req.params.id;
    const updated = await teamsDb.updateTeam(teamId, DEFAULT_COURSE_ID, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// DELETE team
app.delete('/api/teams/:id', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }
    const teamId = req.params.id;
    const deleted = await teamsDb.deleteTeam(teamId, DEFAULT_COURSE_ID);
    if (!deleted) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ------------------------------------------------------------
// Evaluations API (per member)
// ------------------------------------------------------------
// ------------------------------------------------------------
// Course Rubric API
// ------------------------------------------------------------

// Get the rubric for the current course
app.get('/api/rubric', async (req, res) => {
  try {
    // Read-only: if course missing, return empty array
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }

    const items = await rubricDb.getCourseRubric(DEFAULT_COURSE_ID);
    res.json(items);
  } catch (error) {
    console.error('Error fetching rubric:', error);
    res.status(500).json({ error: 'Failed to fetch rubric' });
  }
});

// Create a rubric item
app.post('/api/rubric', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const created = await rubricDb.createRubricItem(DEFAULT_COURSE_ID, req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating rubric item:', error);
    res.status(500).json({ error: error.message || 'Failed to create rubric item' });
  }
});

// Update a rubric item
app.put('/api/rubric/:id', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const { id } = req.params;
    const updated = await rubricDb.updateRubricItem(DEFAULT_COURSE_ID, id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Rubric item not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating rubric item:', error);
    res.status(500).json({ error: error.message || 'Failed to update rubric item' });
  }
});

// Delete a rubric item
app.delete('/api/rubric/:id', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const { id } = req.params;
    const deleted = await rubricDb.deleteRubricItem(DEFAULT_COURSE_ID, id);

    if (!deleted) {
      return res.status(404).json({ error: 'Rubric item not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting rubric item:', error);
    res.status(500).json({ error: error.message || 'Failed to delete rubric item' });
  }
});




























app.get('/api/evaluations/:memberId', async (req, res) => {
  try {
    // Read-only: if course missing, return empty shell for the UI
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json({
        memberId: req.params.memberId,
        teamName: null,
        teamRole: null,
        reports: [],
      });
    }
    const memberId = req.params.memberId;
    const evalData = await evaluationsDb.getEvaluationReportsForMember(
      DEFAULT_COURSE_ID,
      memberId,
    );
    res.json(evalData);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation data' });
  }
});





// ------------------------------------------------------------
// Evaluation Notes API (per member)
// ------------------------------------------------------------

// Get notes for a specific member
app.get('/api/evaluations/:memberId/notes', async (req, res) => {
  try {
    // Read-only: if course missing, return empty list
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }

    const { memberId } = req.params;
    const notes = await evalNotesDb.getNotesForMember(DEFAULT_COURSE_ID, memberId);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching evaluation notes:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation notes' });
  }
});

// Create a note for a member
app.post('/api/evaluations/:memberId/notes', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const { memberId } = req.params;
    const created = await evalNotesDb.createNoteForMember(DEFAULT_COURSE_ID, memberId, req.body);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating evaluation note:', error);
    res.status(500).json({ error: error.message || 'Failed to create evaluation note' });
  }
});


// ------------------------------------------------------------
// Work Journals API (for Evaluation Journal page)
// ------------------------------------------------------------
// ------------------------------------------------------------
// Work Journals API (for Evaluation Journal page)
// ------------------------------------------------------------

// GET /api/work-journals?forName=@student_or_team
app.get('/api/work-journals', async (req, res) => {
  try {
    // Read-only: if DB/course missing, return empty array
    if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }

    const { forName } = req.query;
    const journals = await workJournalsDb.getWorkJournals(DEFAULT_COURSE_ID, {
      forName: forName || null,
    });

    res.json(journals);
  } catch (error) {
    console.error('Error fetching work journals:', error);
    res.status(500).json({ error: 'Failed to fetch work journals' });
  }
});

// CREATE a new work journal entry
app.post('/api/work-journals', async (req, res) => {
  try {
    if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const created = await workJournalsDb.createWorkJournal(DEFAULT_COURSE_ID, req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating work journal:', error);
    res.status(500).json({ error: error.message || 'Failed to create work journal' });
  }
});

// UPDATE an existing work journal entry
app.put('/api/work-journals/:id', async (req, res) => {
  try {
    if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { id } = req.params;
    const updated = await workJournalsDb.updateWorkJournal(DEFAULT_COURSE_ID, id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Work journal entry not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating work journal:', error);
    res.status(500).json({ error: error.message || 'Failed to update work journal' });
  }
});

// DELETE a work journal entry
app.delete('/api/work-journals/:id', async (req, res) => {
  try {
    if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { id } = req.params;
    const deleted = await workJournalsDb.deleteWorkJournal(DEFAULT_COURSE_ID, id);

    if (!deleted) {
      return res.status(404).json({ error: 'Work journal entry not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting work journal:', error);
    res.status(500).json({ error: error.message || 'Failed to delete work journal' });
  }
});






// NOTE: frontend calls: GET /api/work-journals?forName=@something
app.get('/api/work-journals', async (req, res) => {
  try {
    // Read-only: if DB/course missing, return empty array so UI still works
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }

    const { forName } = req.query;

    // Expected DB module function:
    // workJournalsDb.getWorkJournals(courseId, { forName })
    const journals = await workJournalsDb.getWorkJournals(DEFAULT_COURSE_ID, {
      forName: forName || null,
    });

    res.json(journals);
  } catch (error) {
    console.error('Error fetching work journals:', error);
    res.status(500).json({ error: 'Failed to fetch work journals' });
  }
});

// (Optional future extensions: POST/PUT/DELETE for work journals & replies)



// ------------------------------------------------------------
// Work Journal Replies API
// ------------------------------------------------------------

// Get replies for a work journal entry
app.get('/api/work-journals/:id/replies', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json([]);
    }

    const { id } = req.params;
    const replies = await journalRepliesDb.getRepliesForJournal(id);
    res.json(replies);
  } catch (error) {
    console.error('Error fetching work journal replies:', error);
    res.status(500).json({ error: 'Failed to fetch work journal replies' });
  }
});

// Create a reply for a work journal entry
app.post('/api/work-journals/:id/replies', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return;
    }

    const { id } = req.params;
    const created = await journalRepliesDb.createReplyForJournal(id, req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating work journal reply:', error);
    res.status(500).json({ error: error.message || 'Failed to create work journal reply' });
  }
});


// ------------------------------------------------------------
// Class directory (course + staff + teams) & events
// ------------------------------------------------------------

// Main class directory payload
app.get('/api/class_directory', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json({
        course: null,
        instructors: [],
        TAs: [],
        tutors: [],
        Teams: [],
      });
    }
    const data = await classDirectoryDb.getClassDirectory();
    res.json(data);
  } catch (error) {
    console.error('Error reading class directory:', error);
    res.status(500).json({ error: 'Failed to read class directory' });
  }
});

// Course info only
app.get('/api/class-directory/course', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json(null);
    }
    const course = await classDirectoryDb.getCourseOverview();
    res.json(course);
  } catch (error) {
    console.error('Error reading course info:', error);
    res.status(500).json({ error: 'Failed to read course info' });
  }
});

// Individual staff lists
app.get('/api/class-directory/instructors', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json([]);
    }
    const instructors = await classDirectoryDb.getStaffByRole('professor');
    res.json(instructors);
  } catch (error) {
    console.error('Error reading instructors:', error);
    res.status(500).json({ error: 'Failed to read instructors' });
  }
});

app.get('/api/class-directory/tas', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json([]);
    }
    const tas = await classDirectoryDb.getStaffByRole('ta');
    res.json(tas);
  } catch (error) {
    console.error('Error reading TAs:', error);
    res.status(500).json({ error: 'Failed to read TAs' });
  }
});

app.get('/api/class-directory/tutors', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json([]);
    }
    const tutors = await classDirectoryDb.getStaffByRole('tutor');
    res.json(tutors);
  } catch (error) {
    console.error('Error reading tutors:', error);
    res.status(500).json({ error: 'Failed to read tutors' });
  }
});

app.get('/api/class-directory/teams', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json([]);
    }
    const teams = await classDirectoryDb.getCourseTeams();
    res.json(teams);
  } catch (error) {
    console.error('Error reading class directory teams:', error);
    res.status(500).json({ error: 'Failed to read class directory teams' });
  }
});

// Class events
app.get('/api/class-directory/events', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json([]);
    }
    const events = await eventsDb.getEvents();
    res.json(events);
  } catch (error) {
    console.error('Error reading events:', error);
    res.status(500).json({ error: 'Failed to read events' });
  }
});

app.post('/api/class-directory/events', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return; // ensureDb already sent 500
    }
    const event = await eventsDb.createEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/class-directory/events/:id', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return;
    }
    const id = req.params.id;
    const updated = await eventsDb.updateEvent(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/class-directory/events/:id', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return;
    }
    const id = req.params.id;
    const deleted = await eventsDb.deleteEvent(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ------------------------------------------------------------
// Members API (for task tracker & student directory)
// ------------------------------------------------------------

app.get('/api/members', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json([]);
    }
    const members = await membersDb.getMembers();
    res.json(members);
  } catch (error) {
    console.error('Error reading members:', error);
    res.status(500).json({ error: 'Failed to read members' });
  }
});

// ------------------------------------------------------------
// Tasks API (task board)
// ------------------------------------------------------------

app.get('/api/tasks', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json({});
    }
    const board = await tasksDb.getTasksBoard();
    res.json(board);
  } catch (error) {
    console.error('Error reading tasks:', error);
    res.status(500).json({ error: 'Failed to read tasks' });
  }
});

app.put('/api/tasks', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return;
    }
    const board = req.body;
    await tasksDb.overwriteTasksBoard(board);
    res.json({ message: 'Tasks updated' });
  } catch (error) {
    console.error('Error updating tasks:', error);
    res.status(500).json({ error: 'Failed to update tasks' });
  }
});

// ------------------------------------------------------------
// Attendance API (sessions + attendance records)
// ------------------------------------------------------------



// ------------------------------------------------------------
// Attendance API (professor & student)
// ------------------------------------------------------------

// GET all attendance sessions for the default course
app.get('/api/attendance/sessions', async (req, res) => {
  try {
    // Read-only: if course missing, return empty list
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }

    const sessions = await attendanceDb.getSessions(DEFAULT_COURSE_ID);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching attendance sessions:', error);
    res.status(500).json({ error: 'Failed to fetch attendance sessions' });
  }
});

// CREATE a new attendance session (professor)
app.post('/api/attendance/sessions', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const { durationMinutes } = req.body || {};
    const session = await attendanceDb.createSession(DEFAULT_COURSE_ID, {
      durationMinutes,
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating attendance session:', error);
    res.status(500).json({ error: error.message || 'Failed to create attendance session' });
  }
});

// Optional: GET a single session + attendance records
app.get('/api/attendance/sessions/:id', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const sessionId = req.params.id;
    const session = await attendanceDb.getSessionWithAttendance(DEFAULT_COURSE_ID, sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching attendance session:', error);
    res.status(500).json({ error: 'Failed to fetch attendance session' });
  }
});

// Student marks themselves present using a code
app.post('/api/attendance/mark', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return res.json({
        success: false,
        message: 'Attendance not configured for this course',
      });
    }

    const { code, email } = req.body || {};
    const result = await attendanceDb.markAttendanceByCode(DEFAULT_COURSE_ID, code, email);

    // Always 200 with success flag; frontend uses result.success/message
    res.json(result);
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
    });
  }
});

// Get attendance history for a student by email
app.get('/api/attendance/history', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return res.json({
        sessions: [],
        presentCount: 0,
        totalSessions: 0,
      });
    }

    const { email } = req.query;
    const history = await attendanceDb.getHistoryByEmail(DEFAULT_COURSE_ID, email);

    res.json(history);
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({
      sessions: [],
      presentCount: 0,
      totalSessions: 0,
      error: 'Failed to fetch attendance history',
    });
  }
});


// NOTE: frontend attendance pages currently use local data;
// these endpoints allow wiring them to the DB when you’re ready.

// GET all attendance sessions for the default course
app.get('/api/attendance/sessions', async (req, res) => {
  try {
    // Read-only: if course missing, return empty list
    if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
      return res.json([]);
    }

    // Expected DB function:
    // attendanceDb.getSessions(courseId)
    const sessions = await attendanceDb.getSessions(DEFAULT_COURSE_ID);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching attendance sessions:', error);
    res.status(500).json({ error: 'Failed to fetch attendance sessions' });
  }
});

// CREATE a new attendance session
app.post('/api/attendance/sessions', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    // req.body should include things like: { date, topic, notes, ... }
    // Expected DB function:
    // attendanceDb.createSession(courseId, sessionData)
    const session = await attendanceDb.createSession(DEFAULT_COURSE_ID, req.body);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating attendance session:', error);
    res.status(500).json({ error: 'Failed to create attendance session' });
  }
});

// GET a single session with attendance records
app.get('/api/attendance/sessions/:id', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const sessionId = req.params.id;

    // Expected DB function:
    // attendanceDb.getSessionWithAttendance(courseId, sessionId)
    const session = await attendanceDb.getSessionWithAttendance(DEFAULT_COURSE_ID, sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching attendance session:', error);
    res.status(500).json({ error: 'Failed to fetch attendance session' });
  }
});

// UPSERT attendance records for a session (bulk)
app.post('/api/attendance/sessions/:id/attendance', async (req, res) => {
  try {
    if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
      return;
    }

    const sessionId = req.params.id;
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'records must be an array' });
    }

    // Expected DB function:
    // attendanceDb.saveSessionAttendance(courseId, sessionId, records)
    await attendanceDb.saveSessionAttendance(DEFAULT_COURSE_ID, sessionId, records);

    res.json({ message: 'Attendance saved' });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

// ------------------------------------------------------------
// GitHub API integration
// ------------------------------------------------------------

// Fetch GitHub issues for configured repo
async function fetchGitHubIssues(owner, repo, token = '') {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Conductor-App',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Filter out pull requests (they have pull_request property)
  return data.filter((issue) => !issue.pull_request);
}

// Map a GitHub issue to our task format
function mapGitHubIssueToTask(issue, members = []) {
  // Determine status bucket based on issue state and labels
  let group = 'todo';
  if (issue.state === 'closed') {
    group = 'done';
  } else if (
    issue.labels &&
    issue.labels.some((label) => {
      const name = label.name.toLowerCase();
      return name.includes('in-progress') || name.includes('progress') || name.includes('doing');
    })
  ) {
    group = 'progress';
  }

  // Default assignee is GitHub login or "None"
  let assignee = 'None';
  if (issue.assignee) {
    assignee = issue.assignee.login;

    // Try to map to a known member name if possible
    const matchedMember = members.find(
      (m) =>
        (m.name && m.name.toLowerCase().includes(issue.assignee.login.toLowerCase())) ||
        (m.initials && m.initials.toLowerCase() === issue.assignee.login.toLowerCase()),
    );
    if (matchedMember) {
      assignee = matchedMember.name;
    }
  }

  // Priority badge from labels (high/medium/low)
  let badge = 'medium';
  if (issue.labels && issue.labels.some((label) => label.name.toLowerCase().includes('high'))) {
    badge = 'high';
  } else if (
    issue.labels &&
    issue.labels.some((label) => label.name.toLowerCase().includes('low'))
  ) {
    badge = 'low';
  }

  // Due date from milestone if present
  let due = 'TBD';
  if (issue.milestone && issue.milestone.due_on) {
    const dueDate = new Date(issue.milestone.due_on);
    due = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return {
    title: issue.title,
    badge,
    due: issue.state === 'closed' ? 'Completed' : due,
    assignee,
    githubIssueNumber: issue.number,
    githubUrl: issue.html_url,
    githubState: issue.state,
    group,
  };
}

// GitHub config
app.get('/api/github/config', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return res.json({ owner: '', repo: '', token: '' });
    }
    const config = await githubDb.getGithubConfig();
    res.json(config);
  } catch (error) {
    console.error('Error reading GitHub config:', error);
    res.status(500).json({ error: 'Failed to read GitHub config' });
  }
});

app.post('/api/github/config', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return;
    }
    const { owner, repo, token } = req.body;
    const saved = await githubDb.upsertGithubConfig({ owner, repo, token });
    res.json(saved);
  } catch (error) {
    console.error('Error saving GitHub config:', error);
    res.status(500).json({ error: 'Failed to save GitHub config' });
  }
});

// Get raw GitHub issues mapped to tasks (does not modify board)
app.get('/api/github/issues', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return;
    }

    const config = await githubDb.getGithubConfig();
    if (!config.owner || !config.repo) {
      return res.status(400).json({
        error: 'GitHub repository not configured. Please set owner and repo.',
      });
    }

    const issues = await fetchGitHubIssues(config.owner, config.repo, config.token);
    const members = await membersDb.getMembers();
    const mappedTasks = issues.map((issue) => mapGitHubIssueToTask(issue, members));

    res.json({
      issues: mappedTasks,
      count: mappedTasks.length,
    });
  } catch (error) {
    console.error('Error fetching GitHub issues:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub issues', message: error.message });
  }
});

// Sync GitHub issues into our tasks board under a dedicated story
app.post('/api/github/sync', async (req, res) => {
  try {
    if (!ensureDb(res)) {
      return;
    }

    const config = await githubDb.getGithubConfig();
    if (!config.owner || !config.repo) {
      return res.status(400).json({
        error: 'GitHub repository not configured',
      });
    }

    const issues = await fetchGitHubIssues(config.owner, config.repo, config.token);
    const members = await membersDb.getMembers();
    const mappedTasks = issues.map((issue) => mapGitHubIssueToTask(issue, members));

    // Load current tasks board
    const currentTasks = await tasksDb.getTasksBoard();

    // Ensure a story exists for GitHub issues
    const githubStoryName = `GitHub: ${config.owner}/${config.repo}`;
    if (!currentTasks[githubStoryName]) {
      currentTasks[githubStoryName] = { todo: [], progress: [], done: [] };
    }

    // Group mapped tasks into todo/progress/done based on computed group
    const groupedTasks = { todo: [], progress: [], done: [] };
    mappedTasks.forEach((task) => {
      const group = task.group || 'todo';
      groupedTasks[group].push(task);
    });

    // Update board and persist
    currentTasks[githubStoryName] = groupedTasks;
    await tasksDb.overwriteTasksBoard(currentTasks);

    res.json({
      message: 'GitHub issues synced successfully',
      synced: mappedTasks.length,
      story: githubStoryName,
    });
  } catch (error) {
    console.error('Error syncing GitHub issues:', error);
    res.status(500).json({
      error: 'Failed to sync GitHub issues',
      message: error.message,
    });
  }
});

// ------------------------------------------------------------
// Root route
// ------------------------------------------------------------

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ------------------------------------------------------------
// Server bootstrap
// ------------------------------------------------------------

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
