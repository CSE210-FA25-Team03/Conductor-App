require('dotenv').config();
// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Add cookie sessions for state + PKCE storage
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET,
  httpOnly: true,
  secure: false, // true in production behind HTTPS
  sameSite: 'lax',
}));

// --- Mount auth routes ---
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve static assets (e.g., logos, images)
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));


// Serve static files for each role page
app.use('/login', express.static(path.join(__dirname, '../frontend/src/pages/login_page')));
app.use('/new_user', express.static(path.join(__dirname, '../frontend/src/pages/new_user')));
app.use('/professor', express.static(path.join(__dirname, '../frontend/src/pages/professor')));
app.use('/student', express.static(path.join(__dirname, '../frontend/src/pages/student')));
app.use('/ta', express.static(path.join(__dirname, '../frontend/src/pages/ta')));
app.use('/tutor', express.static(path.join(__dirname, '../frontend/src/pages/tutor')));

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
