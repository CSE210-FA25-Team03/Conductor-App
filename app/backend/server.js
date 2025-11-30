// --- Group Formation Backend API ---
const path = require('path');
const fs = require('fs');

/**
 * Backend entry point for our Conductor App.
 * Defines health check routes and initializes the Express server.
 * @module server
 */
// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
// const path = require('path');
// const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Import repository factory
const repositoryFactory = require('./repositories/repositoryFactory');

app.use(express.json()); // Parse JSON bodies

// Initialize repository
const teamsRepository = repositoryFactory.createTeamsRepository();
const evaluationsRepository = repositoryFactory.createEvaluationsRepository();
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
app.use('/work_journal', express.static(path.join(__dirname, '../frontend/src/pages/work_journal')));
app.use('/group_formation', express.static(path.join(__dirname, '../frontend/src/pages/group_formation')));
app.use('/evaluation_journal', express.static(path.join(__dirname, '../frontend/src/pages/evaluation_journal')));
app.use('/class_config', express.static(path.join(__dirname, '../frontend/src/pages/class_config')));
app.use('/attendance', express.static(path.join(__dirname, '../frontend/src/pages/attendance')));
app.use('/class_directory', express.static(path.join(__dirname, '../frontend/src/pages/class_directory')));
app.use('/team_meeting_task', express.static(path.join(__dirname, '../frontend/src/pages/team_meeting_task')));
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

function healthCheck(_req, res) {
  res.json({ status: 'ok' });
}

app.get('/api/health', healthCheck);

// Helper function to read tasks
function getTasks() {
  const filePath = path.join(__dirname, 'data', 'tasks.json');
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

// Helper function to write tasks back to file
function saveTasks(tasks) {
  const filePath = path.join(__dirname, 'data', 'tasks.json');
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), 'utf8');
}

// Helper function to read members
function getMembers() {
  const filePath = path.join(__dirname, 'data', 'members.json');
  if (!fs.existsSync(filePath)) {
    console.error('members.json file not found');
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading members.json:', error);
    return [];
  }
}

// Helper function to read GitHub config
function getGitHubConfig() {
  const filePath = path.join(__dirname, 'data', 'github-config.json');
  if (!fs.existsSync(filePath)) {
    return { owner: '', repo: '', token: '' };
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading github-config.json:', error);
    return { owner: '', repo: '', token: '' };
  }
}

// Helper function to save GitHub config
function saveGitHubConfig(config) {
  const filePath = path.join(__dirname, 'data', 'github-config.json');
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
}

// Helper function to fetch GitHub issues
async function fetchGitHubIssues(owner, repo, token = '') {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Conductor-App'
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const issues = await response.json();
    
    // Filter out pull requests (they have pull_request property)
    return issues.filter(issue => !issue.pull_request);
  } catch (error) {
    console.error('Error fetching GitHub issues:', error);
    throw error;
  }
}

// Helper function to map GitHub issue to task format
function mapGitHubIssueToTask(issue) {
  // Map GitHub issue state to task tracker columns
  let _group = 'todo';
  if (issue.state === 'closed') {
    _group = 'done';
  } else if (issue.labels && issue.labels.some(label => 
    label.name.toLowerCase().includes('in-progress') || 
    label.name.toLowerCase().includes('progress') ||
    label.name.toLowerCase().includes('doing')
  )) {
    _group = 'progress';
  }

  // Extract assignee name (map GitHub username to member name if possible)
  let assignee = 'None';
  if (issue.assignee) {
    assignee = issue.assignee.login;
    // Try to match with members list
    const members = getMembers();
    const matchedMember = members.find(m => 
      m.name.toLowerCase().includes(issue.assignee.login.toLowerCase()) ||
      issue.assignee.login.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
    );
    if (matchedMember) {
      assignee = matchedMember.name;
    }
  }
  
  // Extract difficulty from labels (easy, medium, hard)
  let badge = 'medium';
  if (issue.labels) {
    const labelNames = issue.labels.map(l => l.name.toLowerCase());
    if (labelNames.some(n => n.includes('easy') || n.includes('low') || n.includes('trivial'))) {
      badge = 'easy';
    } else if (labelNames.some(n => n.includes('hard') || n.includes('high') || n.includes('difficult'))) {
      badge = 'hard';
    }
  }

  // Format due date (if milestone exists)
  let due = 'TBD';
  if (issue.milestone && issue.milestone.due_on) {
    const dueDate = new Date(issue.milestone.due_on);
    due = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return {
    title: issue.title,
    badge: badge,
    due: issue.state === 'closed' ? 'Completed' : due,
    assignee: assignee,
    githubIssueNumber: issue.number,
    githubUrl: issue.html_url,
    githubState: issue.state
  };
}

// team/group formation backend logic+ GET POST
const groupFormationPath = path.join(__dirname, 'data', 'group-formation.json');

function readGroupFormation() {
  if (!fs.existsSync(groupFormationPath)) {
    return { skills: [], studentRatings: [], teamLeadRatings: [] };
  }
  return JSON.parse(fs.readFileSync(groupFormationPath, 'utf8'));
}
function writeGroupFormation(data) {
  fs.writeFileSync(groupFormationPath, JSON.stringify(data, null, 2), 'utf8');
}
// GET skills
app.get('/api/group-formation/skills', (req, res) => {
  const data = readGroupFormation();
  res.json(data.skills || []);
});
// POST skills (replace all)
app.post('/api/group-formation/skills', (req, res) => {
  const data = readGroupFormation();
  data.skills = req.body.skills || [];
  writeGroupFormation(data);
  res.json({ message: 'Skills updated', skills: data.skills });
});

// GET student ratings
app.get('/api/group-formation/student-ratings', (req, res) => {
  const data = readGroupFormation();
  res.json(data.studentRatings || []);
});
// POST student rating (add or update)
app.post('/api/group-formation/student-ratings', (req, res) => {
  const data = readGroupFormation();
  const { name, email, ratings } = req.body;
  if (!email || !ratings) return res.status(400).json({ error: 'Missing email or ratings' });
  data.studentRatings = (data.studentRatings || []).filter(s => s.email !== email);
  data.studentRatings.push({ name, email, ratings });
  writeGroupFormation(data);
  res.json({ message: 'Student rating saved', student: { name, email, ratings } });
});

// GET team lead ratings
app.get('/api/group-formation/team-lead-ratings', (req, res) => {
  const data = readGroupFormation();
  res.json(data.teamLeadRatings || []);
});
// POST team lead rating (add or update)
app.post('/api/group-formation/team-lead-ratings', (req, res) => {
  const data = readGroupFormation();
  const { name, email, ratings } = req.body;
  if (!email || !ratings) return res.status(400).json({ error: 'Missing email or ratings' });
  data.teamLeadRatings = (data.teamLeadRatings || []).filter(s => s.email !== email);
  data.teamLeadRatings.push({ name, email, ratings });
  writeGroupFormation(data);
  res.json({ message: 'Team lead rating saved', teamLead: { name, email, ratings } });
});
// Serve student and team lead group formation forms
app.use('/group_formation/student_group_form.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/group_formation/student_group_form.html'));
});
app.use('/group_formation/team_lead_group_form.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/group_formation/team_lead_group_form.html'));
});

// GET all teams
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await teamsRepository.getAllTeams();
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET weekly evaluation data by member ID
app.get('/api/evaluations/:memberId', async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId, 10);
    const evaluation = await evaluationsRepository.getEvaluationByMemberId(memberId);

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    const members = getMembers();
    const member = members.find((m) => m.id === memberId);

    res.json({
      memberId,
      memberName: member?.name || evaluation.memberName || 'Team Member',
      memberRole: evaluation.teamRole || member?.role || 'student',
      teamName: evaluation.teamName || '',
      reports: evaluation.reports || [],
    });
  } catch (error) {
    console.error('Error fetching evaluation:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation' });
  }
});

// GET single team by ID
app.get('/api/teams/:id', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const team = await teamsRepository.getTeamById(teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// POST - Create a new team
app.post('/api/teams', async (req, res) => {
  try {
    const newTeam = await teamsRepository.createTeam(req.body);
    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// GET - Get team(s) by user ID
app.get('/api/teams/:uid', async (req, res) => {
  try 
    const userid = parseInt(req.params.uid);
    const team = await teamsRepository.createTeam(req.body);
    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});


// PUT - Update an existing team
app.put('/api/teams/:id', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const updatedTeam = await teamsRepository.updateTeam(teamId, req.body);
    
    if (!updatedTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// DELETE - Delete a team (bonus endpoint)
app.delete('/api/teams/:id', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const deleted = await teamsRepository.deleteTeam(teamId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.status(204).send(); // No content on successful delete
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
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
    const events = getClassEvents().map((evt) => ({
      ...evt,
      type: evt.type || 'Other'
    }));
    res.json(events);
  } catch (error) {
    console.error('Error reading class events:', error);
    res.status(500).json({ error: 'Failed to read class events' });
  }
});

app.post('/api/class-directory/events', (req, res) => {
  try {
    const { title, description, dueDate, type } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ error: 'title and dueDate are required' });
    }
    const events = getClassEvents();
    const newEvent = {
      id: Date.now().toString(),
      title,
      description: description || '',
      dueDate,
      type: type || 'Other'
    };
    events.push(newEvent);
    saveClassEvents(events);
    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error saving class event:', error);
    res.status(500).json({ error: 'Failed to save class event' });
  }
});

app.put('/api/class-directory/events/:id', (req, res) => {
  try {
    const eventId = req.params.id;
    const events = getClassEvents();
    const index = events.findIndex((evt) => evt.id === eventId);
    if (index === -1) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const existing = events[index];
    const { title, description, dueDate, type } = req.body;
    events[index] = {
      ...existing,
      title: title || existing.title,
      description: description !== undefined ? description : existing.description,
      dueDate: dueDate || existing.dueDate,
      type: type || existing.type || 'Other'
    };
    saveClassEvents(events);
    res.json(events[index]);
  } catch (error) {
    console.error('Error updating class event:', error);
    res.status(500).json({ error: 'Failed to update class event' });
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

// GET all members
app.get('/api/members', (req, res) => {
  const members = getMembers();
  res.json(members);
});

// GET all tasks
app.get('/api/tasks', (req, res) => {
  const tasks = getTasks();
  res.json(tasks);
});

// PUT - Update tasks (replace entire tasks object)
app.put('/api/tasks', (req, res) => {
  const tasks = req.body;
  saveTasks(tasks);
  res.json(tasks);
});

// GET GitHub configuration
app.get('/api/github/config', (req, res) => {
  const config = getGitHubConfig();
  // Don't send token to frontend for security
  res.json({ owner: config.owner, repo: config.repo });
});

// POST - Update GitHub configuration
app.post('/api/github/config', (req, res) => {
  const { owner, repo, token } = req.body;
  const config = { owner, repo, token: token || '' };
  saveGitHubConfig(config);
  res.json({ owner, repo, message: 'Configuration saved' });
});

// GET - Fetch GitHub issues and return as tasks
app.get('/api/github/issues', async (req, res) => {
  try {
    const config = getGitHubConfig();
    
    if (!config.owner || !config.repo) {
      return res.status(400).json({ 
        error: 'GitHub repository not configured. Please set owner and repo.' 
      });
    }

    const issues = await fetchGitHubIssues(config.owner, config.repo, config.token);
    const mappedTasks = issues.map(mapGitHubIssueToTask);
    
    res.json({
      issues: mappedTasks,
      count: mappedTasks.length,
      repo: `${config.owner}/${config.repo}`
    });
  } catch (error) {
    console.error('Error fetching GitHub issues:', error);
    res.status(500).json({ 
      error: 'Failed to fetch GitHub issues', 
      message: error.message 
    });
  }
});

// POST - Sync GitHub issues to tasks (import into task tracker)
app.post('/api/github/sync', async (req, res) => {
  try {
    const config = getGitHubConfig();
    
    if (!config.owner || !config.repo) {
      return res.status(400).json({ 
        error: 'GitHub repository not configured' 
      });
    }

    const issues = await fetchGitHubIssues(config.owner, config.repo, config.token);
    const mappedTasks = issues.map(mapGitHubIssueToTask);
    
    // Get current tasks
    const currentTasks = getTasks();
    
    // Create a story point for GitHub issues if it doesn't exist
    const githubStoryName = `GitHub: ${config.owner}/${config.repo}`;
    if (!currentTasks[githubStoryName]) {
      currentTasks[githubStoryName] = { todo: [], progress: [], done: [] };
    }
    
    // Group tasks by their mapped group (todo, progress, done)
    const groupedTasks = { todo: [], progress: [], done: [] };
    mappedTasks.forEach(task => {
      // Determine group based on GitHub state and labels
      let group = 'todo';
      if (task.githubState === 'closed') {
        group = 'done';
      } else {
        // Check if issue has in-progress label
        const originalIssue = issues.find(i => i.number === task.githubIssueNumber);
        if (originalIssue && originalIssue.labels) {
          const labelNames = originalIssue.labels.map(l => l.name.toLowerCase());
          if (labelNames.some(n => n.includes('in-progress') || n.includes('progress') || n.includes('doing'))) {
            group = 'progress';
          }
        }
      }
      groupedTasks[group].push(task);
    });
    
    // Update the GitHub story with synced tasks
    currentTasks[githubStoryName] = groupedTasks;
    
    // Save tasks
    saveTasks(currentTasks);
    
    res.json({
      message: 'GitHub issues synced successfully',
      synced: mappedTasks.length,
      story: githubStoryName
    });
  } catch (error) {
    console.error('Error syncing GitHub issues:', error);
    res.status(500).json({ 
      error: 'Failed to sync GitHub issues', 
      message: error.message 
    });
  }
});

// Serve evaluation_rubric static files
app.use('/evaluation_rubric', express.static(path.join(__dirname, '../frontend/src/pages/evaluation_rubric')));

// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Export app for testing
module.exports = app;
