// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;


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

// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
