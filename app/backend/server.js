// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve static files for each page (e.g., login)
app.use('/login', express.static(path.join(__dirname, '../frontend/src/pages/login_page')));

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
