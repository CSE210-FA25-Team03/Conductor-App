// backend/server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve frontend statically from ../frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// --- IN-MEMORY DATA (replace with DB later if you want) ---

// Simple users & teams
const teams = [
  { id: 1, name: 'Team Alpha' },
  { id: 2, name: 'Team Beta' }
];

const users = [
  { id: 1, name: 'Prof. Smith', role: 'professor', teamId: null },
  { id: 2, name: 'Alice TL', role: 'team_leader', teamId: 1 },
  { id: 3, name: 'Bob Student', role: 'student', teamId: 1 },
  { id: 4, name: 'Carol Student', role: 'student', teamId: 2 }
];

// Event model (single table)
// scope: 'course' | 'team'
// type: 'class' | 'assignment' | 'meeting' | 'task'
// Either recurring (daysOfWeek + startTime + endTime) OR one-shot (start + end)
let events = [];
let notes = [];

let nextEventId = 1;
let nextNoteId = 1;

// Seed example: recurring class Tue/Thu 17:00-18:20
events.push({
  id: nextEventId++,
  scope: 'course',
  teamId: null,
  createdByUserId: 1,
  title: 'CS101 Lecture',
  description: 'Main class meeting',
  type: 'class',
  isRecurring: true,
  daysOfWeek: [2, 4], // Tue, Thu (FullCalendar: 0=Sun)
  startTime: '17:00:00',
  endTime: '18:20:00',
  start: null,
  end: null,
  deadline: null
});

// Seed example: assignment with deadline
events.push({
  id: nextEventId++,
  scope: 'course',
  teamId: null,
  createdByUserId: 1,
  title: 'HW1 (Deadline)',
  description: 'First assignment',
  type: 'assignment',
  isRecurring: false,
  daysOfWeek: null,
  startTime: null,
  endTime: null,
  start: '2025-11-25T23:59:00',
  end: '2025-11-25T23:59:00',
  deadline: '2025-11-25T23:59:00'
});

// Seed example: team meeting
events.push({
  id: nextEventId++,
  scope: 'team',
  teamId: 1,
  createdByUserId: 2,
  title: 'Weekly Team Sync',
  description: 'Discuss project progress',
  type: 'meeting',
  isRecurring: true,
  daysOfWeek: [3], // Wednesday
  startTime: '18:00:00',
  endTime: '19:00:00',
  start: null,
  end: null,
  deadline: null
});

// --- AUTH-LIKE MIDDLEWARE (very simple) ---
// We "authenticate" via X-User-Id header (frontend sets it).
app.use((req, res, next) => {
  const header = req.header('X-User-Id');
  const id = header ? parseInt(header, 10) : NaN;
  const user = users.find(u => u.id === id) || users[0]; // default to professor if missing
  req.user = user;
  next();
});

// --- HELPERS ---
function getEventsForUser(user) {
  if (!user) return [];
  return events.filter(ev => {
    if (ev.scope === 'course') return true; // everyone sees course events
    if (ev.scope === 'team') {
      // only team members + TL of that team see team events
      return user.teamId && user.teamId === ev.teamId;
    }
    return false;
  });
}

// --- ROUTES ---

// Return current user info + teams
app.get('/api/me', (req, res) => {
  res.json({
    user: req.user,
    teams
  });
});

// List all users (for demo login dropdown on frontend)
app.get('/api/users', (req, res) => {
  res.json(users);
});

// Get all events visible to current user
app.get('/api/events', (req, res) => {
  const list = getEventsForUser(req.user);
  res.json(list);
});

// Create event (professor or team leader only)
app.post('/api/events', (req, res) => {
  const user = req.user;
  if (!user || (user.role !== 'professor' && user.role !== 'team_leader')) {
    return res.status(403).json({ error: 'Only professors or team leaders can create events.' });
  }

  const {
    title,
    description,
    type,         // 'class'|'assignment'|'meeting'|'task'
    isRecurring,  // boolean
    daysOfWeek,   // array of integers if recurring
    startTime,    // HH:mm or HH:mm:ss
    endTime,
    start,        // ISO datetime string if one-shot
    end,
    deadline      // optional ISO datetime for assignment/task deadline
  } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'title and type are required.' });
  }

  if (isRecurring) {
    if (!Array.isArray(daysOfWeek) || !daysOfWeek.length || !startTime || !endTime) {
      return res.status(400).json({ error: 'Recurring events need daysOfWeek, startTime, endTime.' });
    }
  } else {
    if (!start || !end) {
      return res.status(400).json({ error: 'Non-recurring events need start and end.' });
    }
  }

  const scope = user.role === 'professor' ? 'course' : 'team';
  const teamId = user.role === 'team_leader' ? user.teamId : null;

  const event = {
    id: nextEventId++,
    scope,
    teamId,
    createdByUserId: user.id,
    title,
    description: description || '',
    type,
    isRecurring: !!isRecurring,
    daysOfWeek: isRecurring ? daysOfWeek : null,
    startTime: isRecurring ? (startTime.length === 5 ? startTime + ':00' : startTime) : null,
    endTime: isRecurring ? (endTime.length === 5 ? endTime + ':00' : endTime) : null,
    start: !isRecurring ? start : null,
    end: !isRecurring ? end : null,
    deadline: deadline || null
  };

  events.push(event);
  res.status(201).json(event);
});

// Get notes for an event (only for current user)
app.get('/api/events/:eventId/notes', (req, res) => {
  const user = req.user;
  const eventId = parseInt(req.params.eventId, 10);
  const event = getEventsForUser(user).find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or not visible.' });
  }

  const ownNotes = notes
    .filter(n => n.eventId === eventId && n.userId === user.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.json(ownNotes);
});

// Add note for event (only for current user)
app.post('/api/events/:eventId/notes', (req, res) => {
  const user = req.user;
  const eventId = parseInt(req.params.eventId, 10);
  const event = getEventsForUser(user).find(e => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found or not visible.' });
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required.' });
  }

  const now = new Date().toISOString();
  const note = {
    id: nextNoteId++,
    userId: user.id,
    eventId,
    content: content.trim(),
    createdAt: now,
    updatedAt: now
  };
  notes.push(note);
  res.status(201).json(note);
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
