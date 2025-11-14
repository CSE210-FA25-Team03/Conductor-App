// Basic Express server to serve static frontend and prepare for backend features
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const { Pool } = require("pg");
require("dotenv").config();

app.use(express.json()); // Parse JSON bodies

// PostgreSQL / Supabase Session Pooler config
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

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

// Simple test endpoint to confirm DB connectivity
app.get("/user", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users LIMIT 1;");
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ error: "Query failed" });
  }
});

/**
 * TEAMS API
 * Previously read/wrote from ./data/teams.json
 * Now fully backed by the PostgreSQL `teams` table.
 *
 * DB schema:
 *   teams (
 *     id uuid DEFAULT gen_random_uuid() NOT NULL,
 *     course_id uuid NOT NULL,
 *     code text NOT NULL,
 *     name text NOT NULL,
 *     created_at timestamptz DEFAULT now() NOT NULL
 *   )
 *
 * For now we:
 *  - Map DB columns to the existing frontend shape:
 *      { id, teamNumber, name, status, description, members, lastUpdate, nextSync, actionRequired }
 *  - Use placeholder values for fields not in the DB yet (status, description, etc.).
 *  - Optionally filter by course via ?course_id=... or DEFAULT_COURSE_ID env var.
 */

// Helper to map a DB row to the JSON shape your frontend expects
function mapDbTeamToApi(teamRow, index = 0) {
  return {
    id: teamRow.id, // UUID string (frontend should treat as string)
    teamNumber: teamRow.code || `Team ${index + 1}`,
    name: teamRow.name,
    status: 'Needs Review',       // placeholder (no column yet)
    description: '',              // placeholder (no column yet)
    members: [],                  // we will hook team_members later
    lastUpdate: teamRow.created_at,
    nextSync: null,               // placeholder
    actionRequired: false         // placeholder
  };
}


app.get('/api/get_all_team', async (req,res)=>{
  result = await pool.query(`SELECT * FROM teams`)
  res.json(result)
})

// GET all teams
app.get('/api/teams', async (req, res) => {
  try {
    const { course_id } = req.query;
    let result;

    if (course_id) {
      // Client explicitly filters by course
      result = await pool.query(
        `SELECT id, code, name, created_at
         FROM teams
         WHERE course_id = $1
         ORDER BY created_at ASC`,
        [course_id]
      );
    } else if (process.env.DEFAULT_COURSE_ID) {
      // Use a default course if configured
      result = await pool.query(
        `SELECT id, code, name, created_at
         FROM teams
         WHERE course_id = $1
         ORDER BY created_at ASC`,
        [process.env.DEFAULT_COURSE_ID]
      );
    } else {
      // Otherwise return all teams (across courses)
      result = await pool.query(
        `SELECT id, code, name, created_at
         FROM teams
         ORDER BY created_at ASC`
      );
    }

    const teams = result.rows.map((row, idx) => mapDbTeamToApi(row, idx));
    res.json(teams);
  } catch (err) {
    console.error("DB ERROR (GET /api/teams):", err);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

// GET single team by ID (UUID)
app.get('/api/teams/:id', async (req, res) => {
  const teamId = req.params.id; // treat as string UUID

  try {
    const result = await pool.query(
      `SELECT id, code, name, created_at
       FROM teams
       WHERE id = $1`,
      [teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = mapDbTeamToApi(result.rows[0]);
    res.json(team);
  } catch (err) {
    console.error("DB ERROR (GET /api/teams/:id):", err);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

// POST - Create a new team
app.post('/api/teams', async (req, res) => {
  try {
    // Decide which course this team belongs to
    const courseId =
      req.body.courseId ||
      req.body.course_id ||
      process.env.DEFAULT_COURSE_ID;

    if (!courseId) {
      return res.status(400).json({
        error: "courseId is required (either in body or DEFAULT_COURSE_ID env)"
      });
    }

    // Use teamNumber (if provided) as code, otherwise generate something
    const code = req.body.teamNumber || `T-${Date.now()}`;
    const name = req.body.name || code;

    const insertResult = await pool.query(
      `INSERT INTO teams (course_id, code, name)
       VALUES ($1, $2, $3)
       RETURNING id, code, name, created_at`,
      [courseId, code, name]
    );

    const newTeam = mapDbTeamToApi(insertResult.rows[0]);
    res.status(201).json(newTeam);
  } catch (err) {
    console.error("DB ERROR (POST /api/teams):", err);
    res.status(500).json({ error: "Failed to create team" });
  }
});

// PUT - Update an existing team
app.put('/api/teams/:id', async (req, res) => {
  const teamId = req.params.id; // UUID

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    // Allow updating code (teamNumber) and name for now
    if (req.body.teamNumber) {
      fields.push(`code = $${idx++}`);
      values.push(req.body.teamNumber);
    }
    if (req.body.name) {
      fields.push(`name = $${idx++}`);
      values.push(req.body.name);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: "No updatable fields provided (teamNumber or name)"
      });
    }

    values.push(teamId);

    const sql = `
      UPDATE teams
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, code, name, created_at
    `;

    const result = await pool.query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const updatedTeam = mapDbTeamToApi(result.rows[0]);
    res.json(updatedTeam);
  } catch (err) {
    console.error("DB ERROR (PUT /api/teams/:id):", err);
    res.status(500).json({ error: "Failed to update team" });
  }
});

// Fallback: serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
