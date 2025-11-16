// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
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


// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
