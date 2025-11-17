// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Import repository factory
const repositoryFactory = require('./repositories/repositoryFactory');

app.use(express.json()); // Parse JSON bodies

// Initialize repository
const teamsRepository = repositoryFactory.createTeamsRepository();

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

// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});