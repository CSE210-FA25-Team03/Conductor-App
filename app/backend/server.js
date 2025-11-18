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

// Class Directory helper functions
const classDirectoryPath = path.join(__dirname, 'data', 'class_directory.json');
function getClassDirectory() {
  const raw = fs.readFileSync(classDirectoryPath, 'utf8');
  return JSON.parse(raw);
}

function saveClassDirectory(data) {
  fs.writeFileSync(classDirectoryPath, JSON.stringify(data, null, 2), 'utf8');
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
    const data = getClassDirectory();
    res.json(data);
  } catch (error) {
    console.error('Error reading class directory:', error);
    res.status(500).json({ error: 'Failed to read class directory' });
  }
});

app.get('api/class-directory/course', (req, res) => {
  try {
    const data = getClassDirectory();
    const entry = data[0] || null;
    if (!entry) return res.status(404).json({ error: 'No course found' });
    res.json(entry.course);
  } catch (error) {
    console.error('Error reading course:', error);
    res.status(500).json({ error: 'Failed to read course' });
  }
});

// Get instructors list
app.get('api/class-directory/instructors', (req, res) => {
  try {
    const data = getClassDirectory();
    const entry = data[0] || null;
    if (!entry) return res.status(404).json({ error: 'No instructors found' });
    res.json(entry.instructors || []);
  } catch (error) {
    console.error('Error reading instructors:', error);
    res.status(500).json({ error: 'Failed to read instructors' });
  }
});

// Get TAs list
app.get('api/class-directory/tas', (req, res) => {
  try {
    const data = getClassDirectory();
    const entry = data[0] || null;
    if (!entry) return res.status(404).json({ error: 'No TAs found' });
    res.json(entry.TAs || []);
  } catch (error) {
    console.error('Error reading TAs:', error);
    res.status(500).json({ error: 'Failed to read TAs' });
  }
});

// Get tutors list
app.get('api/class-directory/tutors', (req, res) => {
  try {
    const data = getClassDirectory();
    const entry = data[0] || null;
    if (!entry) return res.status(404).json({ error: 'No tutors found' });
    res.json(entry.tutors || []);
  } catch (error) {
    console.error('Error reading tutors:', error);
    res.status(500).json({ error: 'Failed to read tutors' });
  }
});

// Get Teams list
app.get('api/class-directory/teams', (req, res) => {
  try {
    const data = getClassDirectory();
    const entry = data[0] || null;
    if (!entry) return res.status(404).json({ error: 'No teams found' });
    res.json(entry.Teams || []);
  } catch (error) {
    console.error('Error reading teams:', error);
    res.status(500).json({ error: 'Failed to read teams' });
  }
});

// Add Instructor
app.post('/api/class-directory/instructors', (req, res) => {
  try {
    const data = getClassDirectory();
    if (data.length === 0) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const entry = data[0];

    const newInstructor = {
      staff_picture: req.body.staff_picture || 'app/frontend/assets/logo/user.png',
      audio_pronounciation: req.body.audio_pronounciation || '',
      staff_name: req.body.staff_name || '',
      pronounciation: req.body.pronounciation || '',
      pronoun: req.body.pronoun || '',
      contact: req.body.contact || '',
      availability: req.body.availability || ''
    };

    entry.instructors = entry.instructors || [];
    entry.instructors.push(newInstructor);

    saveClassDirectory(data);
    res.status(201).json(newInstructor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add instructor' });
  }
});

// Add TA
app.post('/api/class-directory/tas', (req, res) => {
  try {
    const data = getClassDirectory();
    if (data.length === 0) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const entry = data[0];

    const newTa = {
      staff_picture: req.body.staff_picture || 'app/frontend/assets/logo/user.png',
      audio_pronounciation: req.body.audio_pronounciation || '',
      staff_name: req.body.staff_name || '',
      pronounciation: req.body.pronounciation || '',
      pronoun: req.body.pronoun || '',
      contact: req.body.contact || '',
      availability: req.body.availability || ''
    };

    entry.TAs = entry.TAs || [];
    entry.TAs.push(newTa);

    saveClassDirectory(data);
    res.status(201).json(newTa);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add TA' });
  }
});

// Add Tutor
app.post('/api/class-directory/tutors', (req, res) => {
  try {
    const data = getClassDirectory();
    if (data.length === 0) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const entry = data[0];

    const newTutor = {
      staff_picture: req.body.staff_picture || 'app/frontend/assets/logo/user.png',
      audio_pronounciation: req.body.audio_pronounciation || '',
      staff_name: req.body.staff_name || '',
      pronounciation: req.body.pronounciation || '',
      pronoun: req.body.pronoun || '',
      contact: req.body.contact || '',
      availability: req.body.availability || ''
    };

    entry.tutors = entry.tutors || [];
    entry.tutors.push(newTutor);

    saveClassDirectory(data);
    res.status(201).json(newTutor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add tutor' });
  }
});

// Add Team
app.post('/api/class-directory/teams', (req, res) => {
  try {
    const data = getClassDirectory();
    if (data.length === 0) {
      return res.status(404).json({ error: 'No class directory found' });
    }

    const entry = data[0];

    const newTeam = {
      team_id: req.body.team_id,
      team_name: req.body.team_name || ''
    };

    if (!newTeam.team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    entry.Teams = entry.Teams || [];
    entry.Teams.push(newTeam);

    saveClassDirectory(data);
    res.status(201).json(newTeam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add team' });
  }
});


// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
