// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const { CallTracker } = require('assert/strict');
app.use(express.json()); // Parse JSON bodies

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve static assets (e.g., logos, images)
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));


// Serve static files for each role page
app.use('/login_page', express.static(path.join(__dirname, '../frontend/src/pages/login_page')));
app.use('/login', express.static(path.join(__dirname, '../frontend/src/pages/login_page'), { index: 'login.html' }));
app.get('/login/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/login_page/login.html'));
});
app.use('/team_card', express.static(path.join(__dirname, '../frontend/src/pages/team_card')));
app.use('/new_user', express.static(path.join(__dirname, '../frontend/src/pages/new_user')));
app.use('/task_tracker', express.static(path.join(__dirname, '../frontend/src/pages/task_tracker'))); 
app.use('/tutor', express.static(path.join(__dirname, '../frontend/src/pages/tutor')));
app.use('/dashboards', express.static(path.join(__dirname, '../frontend/src/pages/dashboards')));
app.use('/profile_page', express.static(path.join(__dirname, '../frontend/src/pages/profile_page')));
app.use('/class_directory', express.static(path.join(__dirname, '../frontend/src/pages/class_directory')));
app.use(
  '/class_directory_student',
  express.static(path.join(__dirname, '../frontend/src/pages/class_directory_student'), {
    index: 'class_directory_student.html'
  })
);
app.get('/class_directory_student/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/class_directory_student/class_directory_student.html'));
});

// Class Directory helper functions
const classDirectoryPath = path.join(__dirname, 'data', 'class_directory.json');
function getClassDirectory() {
  const raw = fs.readFileSync(classDirectoryPath, 'utf8');
  return JSON.parse(raw);
}

function saveClassDirectory(data) {
  fs.writeFileSync(classDirectoryPath, JSON.stringify(data, null, 2), 'utf8');
}

const STAFF_FIELDS = [
  'staff_picture',
  'audio_pronounciation',
  'staff_name',
  'pronounciation',
  'pronoun',
  'contact',
  'email',
  'availability'
];

const STAFF_TYPE_META = {
  instructors: { prefix: 'inst', label: 'instructor' },
  TAs: { prefix: 'ta', label: 'TA' },
  tutors: { prefix: 'tutor', label: 'tutor' }
};

function createStaffId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensureDirectoryDataStructure(data) {
  let updated = false;
  if (!Array.isArray(data) || data.length === 0) {
    return { entry: null, data, updated };
  }

  const entry = data[0];
  entry.instructors = entry.instructors || [];
  entry.TAs = entry.TAs || [];
  entry.tutors = entry.tutors || [];
  entry.Teams = entry.Teams || [];

  Object.entries(STAFF_TYPE_META).forEach(([key, meta]) => {
    entry[key] = entry[key].map((person) => {
      if (!person.id) {
        person.id = createStaffId(meta.prefix);
        updated = true;
      }
      return person;
    });
  });

  return { entry, data, updated };
}

function prepareClassDirectory() {
  const data = getClassDirectory();
  const result = ensureDirectoryDataStructure(data);
  if (result.updated) {
    saveClassDirectory(result.data);
  }
  return result;
}

function buildStaffDefaults(body = {}) {
  return {
    staff_picture: body.staff_picture || 'app/frontend/assets/logo/user.png',
    audio_pronounciation: body.audio_pronounciation || '',
    staff_name: body.staff_name || '',
    pronounciation: body.pronounciation || '',
    pronoun: body.pronoun || '',
    contact: body.contact || '',
    email: body.email || '',
    availability: body.availability || ''
  };
}

function applyStaffUpdates(existing, updates = {}) {
  const next = { ...existing };
  STAFF_FIELDS.forEach((field) => {
    if (updates[field] !== undefined) {
      next[field] = updates[field];
    }
  });
  return next;
}

function addStaffEntry(listKey, req, res) {
  try {
    const { data, entry } = prepareClassDirectory();
    if (!entry) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const meta = STAFF_TYPE_META[listKey];
    if (!meta) {
      return res.status(400).json({ error: 'Unknown staff list' });
    }

    const staffList = entry[listKey];
    const newStaff = {
      id: createStaffId(meta.prefix),
      ...buildStaffDefaults(req.body)
    };

    staffList.push(newStaff);
    saveClassDirectory(data);
    res.status(201).json(newStaff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to add ${STAFF_TYPE_META[listKey]?.label || 'staff'}` });
  }
}

function updateStaffEntry(listKey, req, res) {
  try {
    const { data, entry } = prepareClassDirectory();
    if (!entry) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const meta = STAFF_TYPE_META[listKey];
    const staffList = entry[listKey] || [];
    const staffIndex = staffList.findIndex((person) => person.id === req.params.id);

    if (staffIndex === -1) {
      return res.status(404).json({ error: `${meta?.label || 'Staff'} not found` });
    }

    staffList[staffIndex] = applyStaffUpdates(staffList[staffIndex], req.body);
    saveClassDirectory(data);
    res.json(staffList[staffIndex]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to update ${STAFF_TYPE_META[listKey]?.label || 'staff'}` });
  }
}

function deleteStaffEntry(listKey, req, res) {
  try {
    const { data, entry } = prepareClassDirectory();
    if (!entry) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const meta = STAFF_TYPE_META[listKey];
    const staffList = entry[listKey] || [];
    const staffIndex = staffList.findIndex((person) => person.id === req.params.id);

    if (staffIndex === -1) {
      return res.status(404).json({ error: `${meta?.label || 'Staff'} not found` });
    }

    const [removed] = staffList.splice(staffIndex, 1);
    saveClassDirectory(data);
    res.json(removed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to delete ${STAFF_TYPE_META[listKey]?.label || 'staff'}` });
  }
}

// Course calendar events helper functions
const classEventsPath = path.join(__dirname, 'data', 'class_events.json');
function getClassEvents() {
  if (!fs.existsSync(classEventsPath)) {
    fs.writeFileSync(classEventsPath, JSON.stringify([], null, 2));
  }
  const raw = fs.readFileSync(classEventsPath, 'utf8');
  return JSON.parse(raw);
}

function saveClassEvents(events) {
  fs.writeFileSync(classEventsPath, JSON.stringify(events, null, 2), 'utf8');
}

// API endpoint to get class directory data

// Example API endpoint (for future backend logic)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Helper function to read teams
function getTeams() {
  const filePath = path.join(__dirname, 'data', 'teams.json');
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}
// Helper function to write teams back to file
function saveTeams(teams) {
  const filePath = path.join(__dirname, 'data', 'teams.json');
  fs.writeFileSync(filePath, JSON.stringify(teams, null, 2), 'utf8');
}

// GET all teams - hardcoded data for now
app.get('/api/teams', (req, res) => {
  const teams = getTeams();
  res.json(teams);
});

// GET single team by ID
app.get('/api/teams/:id', (req, res) => {
  const teamId = parseInt(req.params.id);
  const teams = getTeams();
  const team = teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  res.json(team);
});

// POST - Create a new team
app.post('/api/teams', (req, res) => {
  const teams = getTeams();
  
  // Find the highest ID and add 1 for the new team
  const maxId = teams.length > 0 ? Math.max(...teams.map(t => t.id)) : 0;
  const newId = maxId + 1;
  
  // Create new team object
  const newTeam = {
    id: newId,
    teamNumber: req.body.teamNumber || `Team ${newId}`,
    name: req.body.name || '',
    status: req.body.status || 'Needs Review',
    description: req.body.description || '',
    members: req.body.members || [],
    ...(req.body.nextSync && { nextSync: req.body.nextSync }),
    ...(req.body.lastUpdate && { lastUpdate: req.body.lastUpdate }),
    ...(req.body.actionRequired && { actionRequired: req.body.actionRequired })
  };
  
  // Add new team to array
  teams.push(newTeam);
  
  // Save to file
  saveTeams(teams);
  
  // Return the newly created team
  res.status(201).json(newTeam);
});

// PUT - Update an existing team
app.put('/api/teams/:id', (req, res) => {
  const teamId = parseInt(req.params.id);
  const teams = getTeams();
  
  // Find the team to update
  const teamIndex = teams.findIndex(t => t.id === teamId);
  
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Update the team with new data (merge with existing)
  const updatedTeam = {
    ...teams[teamIndex],
    ...req.body,
    id: teamId // Ensure ID can't be changed
  };
  
  teams[teamIndex] = updatedTeam;
  
  // Save to file
  saveTeams(teams);
  
  // Return the updated team
  res.json(updatedTeam);
});

// Class Directory basic API
app.get('/api/class_directory', (req, res) => {
  try {
    const { data } = prepareClassDirectory();
    res.json(data);
  } catch (error) {
    console.error('Error reading class directory:', error);
    res.status(500).json({ error: 'Failed to read class directory' });
  }
});

app.get('/api/class-directory/course', (req, res) => {
  try {
    const { entry } = prepareClassDirectory();
    if (!entry) return res.status(404).json({ error: 'No course found' });
    res.json(entry.course);
  } catch (error) {
    console.error('Error reading course:', error);
    res.status(500).json({ error: 'Failed to read course' });
  }
});

// Get instructors list
app.get('/api/class-directory/instructors', (req, res) => {
  try {
    const { entry } = prepareClassDirectory();
    if (!entry) return res.status(404).json({ error: 'No instructors found' });
    res.json(entry.instructors || []);
  } catch (error) {
    console.error('Error reading instructors:', error);
    res.status(500).json({ error: 'Failed to read instructors' });
  }
});

// Get TAs list
app.get('/api/class-directory/tas', (req, res) => {
  try {
    const { entry } = prepareClassDirectory();
    if (!entry) return res.status(404).json({ error: 'No TAs found' });
    res.json(entry.TAs || []);
  } catch (error) {
    console.error('Error reading TAs:', error);
    res.status(500).json({ error: 'Failed to read TAs' });
  }
});

// Get tutors list
app.get('/api/class-directory/tutors', (req, res) => {
  try {
    const { entry } = prepareClassDirectory();
    if (!entry) return res.status(404).json({ error: 'No tutors found' });
    res.json(entry.tutors || []);
  } catch (error) {
    console.error('Error reading tutors:', error);
    res.status(500).json({ error: 'Failed to read tutors' });
  }
});

// Get Teams list
app.get('/api/class-directory/teams', (req, res) => {
  try {
    const { entry } = prepareClassDirectory();
    if (!entry) return res.status(404).json({ error: 'No teams found' });
    res.json(entry.Teams || []);
  } catch (error) {
    console.error('Error reading teams:', error);
    res.status(500).json({ error: 'Failed to read teams' });
  }
});

// Add Instructor
app.post('/api/class-directory/instructors', (req, res) => {
  addStaffEntry('instructors', req, res);
});

// Add TA
app.post('/api/class-directory/tas', (req, res) => {
  addStaffEntry('TAs', req, res);
});

// Add Tutor
app.post('/api/class-directory/tutors', (req, res) => {
  addStaffEntry('tutors', req, res);
});

app.put('/api/class-directory/instructors/:id', (req, res) => {
  updateStaffEntry('instructors', req, res);
});

app.delete('/api/class-directory/instructors/:id', (req, res) => {
  deleteStaffEntry('instructors', req, res);
});

app.put('/api/class-directory/tas/:id', (req, res) => {
  updateStaffEntry('TAs', req, res);
});

app.delete('/api/class-directory/tas/:id', (req, res) => {
  deleteStaffEntry('TAs', req, res);
});

app.put('/api/class-directory/tutors/:id', (req, res) => {
  updateStaffEntry('tutors', req, res);
});

app.delete('/api/class-directory/tutors/:id', (req, res) => {
  deleteStaffEntry('tutors', req, res);
});

// Add Team
app.post('/api/class-directory/teams', (req, res) => {
  try {
    const { data, entry } = prepareClassDirectory();
    if (!entry) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const newTeam = {
      team_id: req.body.team_id,
      team_name: req.body.team_name || ''
    };

    if (!newTeam.team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    entry.Teams.push(newTeam);

    saveClassDirectory(data);
    res.status(201).json(newTeam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add team' });
  }
});

// Class calendar events
app.get('/api/class-directory/events', (req, res) => {
  try {
    const events = getClassEvents();
    res.json(events);
  } catch (error) {
    console.error('Error reading class events:', error);
    res.status(500).json({ error: 'Failed to read class events' });
  }
});

app.post('/api/class-directory/events', (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ error: 'title and dueDate are required' });
    }
    const events = getClassEvents();
    const newEvent = {
      id: Date.now().toString(),
      title,
      description: description || '',
      dueDate
    };
    events.push(newEvent);
    saveClassEvents(events);
    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error saving class event:', error);
    res.status(500).json({ error: 'Failed to save class event' });
  }
});

app.delete('/api/class-directory/events/:id', (req, res) => {
  try {
    const eventId = req.params.id;
    const events = getClassEvents();
    const eventIndex = events.findIndex((evt) => evt.id === eventId);
    if (eventIndex === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const [deleted] = events.splice(eventIndex, 1);
    saveClassEvents(events);
    res.json(deleted);
  } catch (error) {
    console.error('Error deleting class event:', error);
    res.status(500).json({ error: 'Failed to delete class event' });
  }
});


// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
