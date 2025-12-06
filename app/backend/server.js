  // backend/server.js
  require('dotenv').config();

  const path = require('path');
  const express = require('express');

  const groupFormationDb = require('./db/groupFormation');
  const teamsDb = require('./db/teams');
  const teamCardDb = require('./db/teamCard');
  const dbCore = require('./db/index');
  const teamEventsDb = require('./db/teamEvents');
  const evaluationsDb = require('./db/evaluations');
  const classDirectoryDb = require('./db/classDirectory');
  const eventsDb = require('./db/events');
  const membersDb = require('./db/members');
  const tasksDb = require('./db/tasks');
  const githubDb = require('./db/github');
  const githubApi = require('./services/githubApi');
  const workJournalsDb = require('./db/workJournals');
  const attendanceDb = require('./db/attendance');
  const rubricDb = require('./db/rubric');
  const evalNotesDb = require('./db/evalNotes');
  const journalRepliesDb = require('./db/journalReplies');
  const studentWeeklyDb = require('./db/studentWeekly');
  const studentWeeklyEvalDb = require('./db/studentWeeklyEval');
  const rostersDb = require('./db/rosters');
  const profileDb = require('./db/profile');
  const app = express();
  const PORT = process.env.PORT || 3000;
/**
 * Backend entry point for our Conductor App.
 * Defines health check routes and initializes the Express server.
 * @module server
 */
// Basic Express server to serve static frontend and prepare for backend features
const cookieSession = require('cookie-session');

// Add cookie sessions for state + PKCE storage
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET],   
  httpOnly: true,
  secure: false, 
  sameSite: 'lax'
}));


// --- Mount auth routes ---
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);


// ------------------------------------------------------------
// Configuration flags
// ------------------------------------------------------------

// DB is considered "configured" if we at least have a DATABASE_URL.
// Some routes ALSO need DEFAULT_COURSE_ID (course-scoped data).
const hasDbConfig = !!process.env.DATABASE_URL;
const hasCourseConfig = !!process.env.DEFAULT_COURSE_ID;
const DEFAULT_COURSE_ID = process.env.DEFAULT_COURSE_ID || null;

// Safe fetch wrapper for GitHub integration.
// Requires Node 18+ (global fetch). If not available, we throw a clear error.
const fetch =
  global.fetch ||
  (() => {
    throw new Error(
      'Global fetch is not available. Run on Node 18+ or add a fetch polyfill (e.g. node-fetch).',
    )});

  // ------------------------------------------------------------
  // Middleware
  // ------------------------------------------------------------
  // Increase JSON/urlencoded body limits to allow profile photo (base64) uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Note: Static asset serving is registered AFTER API routes to avoid
  // potential header conflicts when static middleware encounters errors.

  // Serve static files for each role/page
  app.use('/shared', express.static(path.join(__dirname, '../frontend/src/shared')));
  app.use('/login_page', express.static(path.join(__dirname, '../frontend/src/pages/login_page')));
  app.use(
    '/login',
    express.static(path.join(__dirname, '../frontend/src/pages/login_page'), {
      index: 'login.html',
    }),
  );
  app.get('/login/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/src/pages/login_page/login.html'));
  });

  app.use('/team_card', express.static(path.join(__dirname, '../frontend/src/pages/team_card')));
  app.use('/student_team_card', express.static(path.join(__dirname, '../frontend/src/pages/student_team_card'), { index: 'student_team_card.html' }));
  app.use('/new_user', express.static(path.join(__dirname, '../frontend/src/pages/new_user')));
  app.use('/task_tracker', express.static(path.join(__dirname, '../frontend/src/pages/task_tracker')));
  app.use('/tutor', express.static(path.join(__dirname, '../frontend/src/pages/tutor')));
  app.use('/dashboards', express.static(path.join(__dirname, '../frontend/src/pages/dashboards')));
  app.use('/profile_page', express.static(path.join(__dirname, '../frontend/src/pages/profile_page')));
  app.use('/work_journal', express.static(path.join(__dirname, '../frontend/src/pages/work_journal')));
  app.use('/admin', express.static(path.join(__dirname, '../frontend/src/pages/admin')));
  app.use(
    '/group_formation',
    express.static(path.join(__dirname, '../frontend/src/pages/group_formation')),
  );

  app.use('/group_formation/student_group_form.html', (req, res) => {
    res.sendFile(
      path.join(__dirname, '../frontend/src/pages/group_formation/student_group_form.html'),
    );
  });

  app.use('/group_formation/team_lead_group_form.html', (req, res) => {
    res.sendFile(
      path.join(__dirname, '../frontend/src/pages/group_formation/team_lead_group_form.html'),
    );
  });

  app.use(
    '/evaluation_journal',
    express.static(path.join(__dirname, '../frontend/src/pages/evaluation_journal')),
  );
  app.use('/class_config', express.static(path.join(__dirname, '../frontend/src/pages/class_config')));
  app.use('/attendance', express.static(path.join(__dirname, '../frontend/src/pages/attendance')));
  app.use(
    '/class_directory',
    express.static(path.join(__dirname, '../frontend/src/pages/class_directory_student'), {
      index: 'class_directory_student.html',
    }),
  );
  app.use(
    '/class_directory',
    express.static(path.join(__dirname, '../frontend/src/pages/class_directory')),
  );
  app.use(
    '/team_meeting_task',
    express.static(path.join(__dirname, '../frontend/src/pages/team_meeting_task')),
  );

  app.use(
    '/class_directory_student',
    express.static(path.join(__dirname, '../frontend/src/pages/class_directory_student'), {
      index: 'class_directory_student.html',
    }),
  );
  app.get('/class_directory_student/', (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        '../frontend/src/pages/class_directory_student/class_directory_student.html',
      ),
    );
  });

  app.use(
    '/evaluation_rubric',
    express.static(path.join(__dirname, '../frontend/src/pages/evaluation_rubric')),
  );

  // ------------------------------------------------------------
  // Health check
  // ------------------------------------------------------------
  function healthCheck(_req, res) {
    res.json({ status: 'ok' });
  }

  app.get('/api/health', healthCheck);




  // ------------------------------------------------------------
  // Helper: ensure DB config for routes that require it
  // ------------------------------------------------------------

  /**
   * For routes that need a DB connection.
   * - If DB is not configured at all -> 500 error.
   * - Course-scoped routes should also check hasCourseConfig or DEFAULT_COURSE_ID.
   *
   * Returns true if DB is available, false if it already responded with an error.
   */
  function ensureDb(res, { requireCourse = false, errorOnMissingCourse = true } = {}) {
    if (!hasDbConfig) {
      res.status(500).json({ error: 'Database not configured' });
      return false;
    }
    if (requireCourse && !hasCourseConfig) {
      if (errorOnMissingCourse) {
        res.status(500).json({ error: 'Course not configured' });
      }
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------
  // Auth / Login: resolve user role & target dashboard from DB
  // ------------------------------------------------------------
  app.post('/api/auth/resolve-login', async (req, res) => {
    try {
      // Need DB + course configured
      if (
        !ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) ||
        !DEFAULT_COURSE_ID
      ) {
        return res.status(500).json({
          success: false,
          message: 'Course/database not configured for login',
        });
      }

      const { email } = req.body || {};
      const normalizedEmail = (email || '').trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email is required',
        });
      }

      const ctx = await classDirectoryDb.getUserCourseContextByEmail(
        normalizedEmail,
      );

      if (!ctx.user) {
        return res.status(404).json({
          success: false,
          message:
            'No user found with that email in the course roster. Please check with your instructor.',
        });
      }

      if (!ctx.inCourse || !ctx.primaryRole) {
        // Fallback: allow professors to log in using any course they are assigned to
        const { rows: profCourse } = await dbCore.query(
          `SELECT ra.scope_id AS course_id
             FROM role_assignments ra
             JOIN roles r ON r.id = ra.role_id
            WHERE ra.user_id = $1 AND ra.scope_type = 'course' AND r.key = 'professor'
            LIMIT 1`,
          [ctx.user.id]
        );
        if (!profCourse.length) {
          return res.status(403).json({
            success: false,
            message:
              'This account is not enrolled in the current course. Please check with your instructor.',
          });
        }

        // Build a synthetic context for professor on their course
        const profCourseId = profCourse[0].course_id;
        const primaryRole = 'professor';
        const redirectPath = '/dashboards/professor.html';
        return res.json({
          success: true,
          user: ctx.user,
          courseId: profCourseId,
          primaryRole,
          redirectPath,
          roles: ['professor'],
          isTeamLead: false,
          teamLeadTeams: [],
        });
      }

      const primaryRole = ctx.primaryRole;
      let redirectPath = '/dashboards/student.html';

      if (primaryRole === 'admin') {
        redirectPath = '/admin/admin.html';
      } else if (primaryRole === 'professor') {
        redirectPath = '/dashboards/professor.html';
      } else if (primaryRole === 'ta') {
        redirectPath = '/dashboards/ta.html';
      } else if (primaryRole === 'team_lead') {
        redirectPath = '/dashboards/team_lead.html';
      } else if (primaryRole === 'tutor') {
        // You can point tutors to a special dashboard later; for now treat as student.
        redirectPath = '/dashboards/student.html';
      }
      return res.json({
        success: true,
        user: ctx.user,
        courseId: ctx.courseId,
        primaryRole,
        redirectPath,
        roles: ctx.roles,
        isTeamLead: ctx.isTeamLead,
        teamLeadTeams: ctx.teamLeadTeams,
      });
    } catch (error) {
      console.error('Error resolving login:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to resolve login. Please try again.',
      });
    }
  });

  // ------------------------------------------------------------
  // Admin: Create/Update Course and Professor linkage
  // ------------------------------------------------------------
  // body: { courseCode, profFirst, profLast, profEmail }
  app.post('/api/admin/course-professor', async (req, res) => {
    try {
      // Only require DB; this endpoint should work without DEFAULT_COURSE_ID
      if (!ensureDb(res)) return;

      const { courseCode, profFirst, profLast, profEmail } = req.body || {};
      const code = (courseCode || '').trim();
      const first = (profFirst || '').trim();
      const last = (profLast || '').trim();
      const email = (profEmail || '').trim().toLowerCase();

      if (!code || !first || !last || !email) {
        return res.status(400).json({ success: false, message: 'courseCode, profFirst, profLast, profEmail are required' });
      }

      // Determine term to use:
      // 1) If DEFAULT_COURSE_ID points to a course, reuse its term_id
      // 2) Otherwise, upsert the current term by code (e.g., 'FA25') based on current date
      let termId = null;
      if (DEFAULT_COURSE_ID) {
        const { rows: termRows } = await dbCore.query(
          `SELECT term_id FROM courses WHERE id = $1 LIMIT 1`,
          [DEFAULT_COURSE_ID]
        );
        if (termRows.length) {
          termId = termRows[0].term_id;
        }
      }
      if (!termId) {
        const now = new Date();
        const m = now.getMonth(); // 0-11
        const yFull = now.getFullYear();
        const y2 = String(yFull % 100).padStart(2, '0');
        let season = 'FA';
        let seasonName = 'Fall';
        if (m <= 2) { season = 'WI'; seasonName = 'Winter'; }
        else if (m <= 5) { season = 'SP'; seasonName = 'Spring'; }
        else if (m <= 7) { season = 'SU'; seasonName = 'Summer'; }
        else { season = 'FA'; seasonName = 'Fall'; }
        const termCode = `${season}${y2}`; // e.g., FA25
        const termName = `${seasonName} ${yFull}`; // e.g., Fall 2025

        // Upsert term by unique code
        const { rows: existingTerm } = await dbCore.query(
          `SELECT id FROM terms WHERE code = $1 LIMIT 1`,
          [termCode]
        );
        if (existingTerm.length) {
          termId = existingTerm[0].id;
        } else {
          const { rows: newTerm } = await dbCore.query(
            `INSERT INTO terms (code, name) VALUES ($1, $2) RETURNING id`,
            [termCode, termName]
          );
          termId = newTerm[0].id;
        }
      }

      // Upsert user (professor)
      let userId;
      const displayName = `${first} ${last}`.trim();
      const { rows: userRows } = await dbCore.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      let createdUser = false;
      if (userRows.length) {
        userId = userRows[0].id;
        await dbCore.query(
          `UPDATE users SET given_name = $2, family_name = $3, display_name = $4, updated_at = now() WHERE id = $1`,
          [userId, first, last, displayName]
        );
      } else {
        const { rows: insertUser } = await dbCore.query(
          `INSERT INTO users (email, email_verified_at, given_name, family_name, display_name)
           VALUES ($1, now(), $2, $3, $4) RETURNING id`,
          [email, first, last, displayName]
        );
        userId = insertUser[0].id;
        createdUser = true;
      }

      // Ensure professor role exists
      const { rows: roleRows } = await dbCore.query(
        `SELECT id FROM roles WHERE key = 'professor' LIMIT 1`
      );
      let professorRoleId;
      if (roleRows.length) {
        professorRoleId = roleRows[0].id;
      } else {
        const { rows: createdRole } = await dbCore.query(
          `INSERT INTO roles (key, label) VALUES ('professor','Professor') RETURNING id`
        );
        professorRoleId = createdRole[0].id;
      }

      // Upsert course by (term_id, code)
      const normCode = code.toUpperCase();
      let courseId;
      let createdCourse = false;
      const { rows: courseRows } = await dbCore.query(
        `SELECT id FROM courses WHERE term_id = $1 AND code = $2 LIMIT 1`,
        [termId, normCode]
      );
      if (courseRows.length) {
        courseId = courseRows[0].id;
      } else {
        const { rows: createdCourseRows } = await dbCore.query(
          `INSERT INTO courses (term_id, code, title) VALUES ($1, $2, $3) RETURNING id`,
          [termId, normCode, normCode]
        );
        courseId = createdCourseRows[0].id;
        createdCourse = true;
      }

      // Ensure course membership
      let createdMembership = false;
      const { rows: membershipRows } = await dbCore.query(
        `SELECT id FROM course_memberships WHERE course_id = $1 AND user_id = $2 LIMIT 1`,
        [courseId, userId]
      );
      if (!membershipRows.length) {
        await dbCore.query(
          `INSERT INTO course_memberships (course_id, user_id, status) VALUES ($1, $2, 'active')`,
          [courseId, userId]
        );
        createdMembership = true;
      }

      // Ensure role assignment (professor in that course)
      let createdAssignment = false;
      const { rows: assignRows } = await dbCore.query(
        `SELECT id FROM role_assignments WHERE user_id = $1 AND role_id = $2 AND scope_type = 'course' AND scope_id = $3 LIMIT 1`,
        [userId, professorRoleId, courseId]
      );
      if (!assignRows.length) {
        await dbCore.query(
          `INSERT INTO role_assignments (user_id, role_id, scope_type, scope_id) VALUES ($1, $2, 'course', $3)`,
          [userId, professorRoleId, courseId]
        );
        createdAssignment = true;
      }

      const alreadyInCourse = !createdMembership && !createdAssignment;
      const message = alreadyInCourse
        ? 'Professor already in course'
        : createdCourse
        ? 'Course created and professor added'
        : 'Professor added to existing course';

      return res.json({
        success: true,
        message,
        course: { id: courseId, code: normCode },
        professor: { id: userId, email, displayName },
        created: {
          course: createdCourse,
          user: createdUser,
          membership: createdMembership,
          assignment: createdAssignment,
        },
      });
    } catch (error) {
      console.error('Error upserting course/professor:', error);
      return res.status(500).json({ success: false, message: 'Failed to upsert course/professor' });
    }
  });


  // ------------------------------------------------------------
  // Course Rosters API (upload from class_config page)
  // ------------------------------------------------------------

  app.post('/api/courses/rosters', async (req, res) => {
    try {
      // Need DB + course configured
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const { classRosterCsv, staffRosterCsv } = req.body || {};

      if ((!classRosterCsv || !classRosterCsv.trim()) &&
          (!staffRosterCsv || !staffRosterCsv.trim())) {
        return res.status(400).json({ error: 'No roster data provided' });
      }

      const result = await rostersDb.importRosters(DEFAULT_COURSE_ID, {
        classRosterCsv,
        staffRosterCsv,
      });

      // Your frontend expects { classRows, staffRows }
      res.json(result);
    } catch (error) {
      console.error('Error importing rosters:', error);
      res.status(500).json({ error: 'Failed to import rosters' });
    }
  });


  // ------------------------------------------------------------
  // Group Formation API (skills + ratings)
  // ------------------------------------------------------------

  // GET skills
  app.get('/api/group-formation/skills', async (req, res) => {
    try {
      // Read-only: if course missing, return empty list instead of 500
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }
      const skills = await groupFormationDb.getSkills(DEFAULT_COURSE_ID);
      res.json(skills);
    } catch (error) {
      console.error('Error loading skills:', error);
      res.status(500).json({ error: 'Failed to load skills' });
    }
  });

  // POST (create/update) a skill
  app.post('/api/group-formation/skills', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return; // ensureDb already responded with 500
      }
      const skill = await groupFormationDb.upsertSkill(DEFAULT_COURSE_ID, req.body);
      res.status(201).json(skill);
    } catch (error) {
      console.error('Error saving skill:', error);
      res.status(500).json({ error: 'Failed to save skill' });
    }
  });

  // UPDATE a skill by id
  app.put('/api/group-formation/skills/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      const { id } = req.params;
      const { name, weight, description, position } = req.body || {};
      const updated = await groupFormationDb.upsertSkill(DEFAULT_COURSE_ID, {
        id,
        name,
        weight,
        description,
        position,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating skill:', error);
      res.status(500).json({ error: 'Failed to update skill' });
    }
  });

  // DELETE a skill by id
  app.delete('/api/group-formation/skills/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      const { id } = req.params;
      const deleted = await groupFormationDb.deleteSkill(DEFAULT_COURSE_ID, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting skill:', error);
      res.status(500).json({ error: 'Failed to delete skill' });
    }
  });

  // GET student ratings
  app.get('/api/group-formation/student-ratings', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }
      const ratings = await groupFormationDb.getStudentRatings(DEFAULT_COURSE_ID);
      res.json(ratings);
    } catch (error) {
      console.error('Error loading student ratings:', error);
      res.status(500).json({ error: 'Failed to load student ratings' });
    }
  });

  // ------------------------------------------------------------
  // Group Formation – Groups (teams, members, TA assignments)
  // ------------------------------------------------------------

  // GET existing groups for current course
  app.get('/api/group-formation/groups', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }

      const groups = await groupFormationDb.getGroups(DEFAULT_COURSE_ID);
      res.json(groups);
    } catch (error) {
      console.error('Error loading groups:', error);
      res.status(500).json({ error: 'Failed to load groups' });
    }
  });

  // POST save groups for current course
  // body: { groups: [ { teamName?, taUserId?, members: [{ userId, role }] } ] }
  app.post('/api/group-formation/groups', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const { groups } = req.body || {};
      await groupFormationDb.saveGroups(DEFAULT_COURSE_ID, Array.isArray(groups) ? groups : []);

      const saved = await groupFormationDb.getGroups(DEFAULT_COURSE_ID);
      res.json({
        message: 'Groups saved successfully',
        groups: saved,
      });
    } catch (error) {
      console.error('Error saving groups:', error);
      res.status(500).json({ error: error.message || 'Failed to save groups' });
    }
  });


  // GET ratings for the current student (by email or userId)
  app.get('/api/group-formation/student-ratings/me', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json({});
      }

      const { email, userId } = req.query;

      const ratingsBySkillId = await groupFormationDb.getStudentRatingsForUser(
        DEFAULT_COURSE_ID,
        { userId, email },
      );

      res.json(ratingsBySkillId); // { [skillId]: rating }
    } catch (error) {
      console.error('Error loading current student ratings:', error);
      res.status(500).json({ error: 'Failed to load current student ratings' });
    }
  });


  // POST student ratings
  // POST student ratings
  // POST student ratings
  app.post('/api/group-formation/student-ratings', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const { userId, email, skillRatings } = req.body;

      await groupFormationDb.upsertStudentRating(DEFAULT_COURSE_ID, {
        userId,
        email,
        skillRatings,
      });

      res.json({ message: 'Student rating saved' });
    } catch (error) {
      console.error('Error saving student rating:', error);
      res.status(500).json({ error: 'Failed to save student rating' });
    }
  });



  // GET team lead ratings
  app.get('/api/group-formation/team-lead-ratings', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }
      const ratings = await groupFormationDb.getTeamLeadRatings(DEFAULT_COURSE_ID);
      res.json(ratings);
    } catch (error) {
      console.error('Error loading team lead ratings:', error);
      res.status(500).json({ error: 'Failed to load team lead ratings' });
    }
  });

  // POST team lead ratings
  app.post('/api/group-formation/team-lead-ratings', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      const { userId, skillRatings } = req.body;
      await groupFormationDb.upsertTeamLeadRating(DEFAULT_COURSE_ID, { userId, skillRatings });
      res.json({ message: 'Team lead rating saved' });
    } catch (error) {
      console.error('Error saving team lead rating:', error);
      res.status(500).json({ error: 'Failed to save team lead rating' });
    }
  });

  // ------------------------------------------------------------
  // Teams API
  // ------------------------------------------------------------

  // GET all teams

  app.get('/api/teams', async (req, res) => {
    try {
      // Always return an array for this read-only route
      if (!hasDbConfig) {
        return res.json([]);
      }
      if (!hasCourseConfig || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }

      const teams = await teamsDb.getAllTeams(DEFAULT_COURSE_ID);
      res.json(Array.isArray(teams) ? teams : []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      return res.json([]); // 200 by default; guarantee array
    }
  });


  // app.get('/api/teams', async (req, res) => {
  //   try {
  //     // Read-only: if course missing, return empty list
  //     const ok = ensureDb(res, { requireCourse: true, errorOnMissingCourse: false });
  //     if (!ok) {
  //       // If DB itself is missing, ensureDb already sent a 500; do not send again
  //       if (!hasDbConfig) return;
  //       // Course is missing: return empty list for read-only endpoints
  //       return res.json([]);
  //     }
  //     if (!DEFAULT_COURSE_ID) {
  //       return res.json([]);
  //     }
  //     const teams = await teamsDb.getAllTeams(DEFAULT_COURSE_ID);
  //     res.json(teams);
  //   } catch (error) {
  //     console.error('Error fetching teams:', error);
  //     // Read-only tolerance: return an empty list on unexpected errors
  //     res.status(200).json([]);

  //   }
  // });


  // GET single team by ID
  app.get('/api/teams/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      const teamId = req.params.id;
      const team = await teamsDb.getTeamById(teamId, DEFAULT_COURSE_ID);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      res.json(team);
    } catch (error) {
      console.error('Error fetching team:', error);
      res.status(500).json({ error: 'Failed to fetch team' });
    }
  });

  // Team Card detailed info
  app.get('/api/team-card/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Course/database not configured' });
      }
      const teamId = req.params.id;
      const data = await teamCardDb.getTeamCard(teamId);
      if (!data) return res.status(404).json({ error: 'Team not found' });
      res.json(data);
    } catch (error) {
      console.error('Error reading team card:', error);
      res.status(500).json({ error: 'Failed to read team card' });
    }
  });

  // Update team card description / status description (team lead, TA, professor)
  app.put('/api/team-card/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Course/database not configured' });
      }
      const teamId = req.params.id;
      const { description, statusDescription, repoUrl, email } = req.body || {};
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ error: 'email is required for authorization' });
      }

      // Load user context (roles & team lead flag) for authorization
      const ctx = await classDirectoryDb.getUserCourseContextByEmail(normalizedEmail);
      if (!ctx.user || !ctx.inCourse) {
        return res.status(403).json({ error: 'User not in course' });
      }

      const primaryRole = ctx.primaryRole;
      let authorized = false;
      if (primaryRole === 'professor' || primaryRole === 'ta') {
        authorized = true; // instructors & TAs can edit any team
      } else if (primaryRole === 'team_lead') {
        // Verify this user is the leader of the target team
        const { rows: leadRows } = await dbCore.query(
          `SELECT 1
           FROM team_members tm
           JOIN users u ON u.id = tm.user_id
           WHERE tm.team_id = $1 AND LOWER(u.email) = LOWER($2) AND tm.is_leader = true
           LIMIT 1`,
          [teamId, normalizedEmail]
        );
        authorized = leadRows.length > 0;
      }

      if (!authorized) {
        return res.status(403).json({ error: 'Not authorized to edit this team' });
      }

      const updated = await teamCardDb.updateTeamDescriptions(teamId, { description, statusDescription, repoUrl });
      if (!updated) return res.status(404).json({ error: 'Team not found' });
      res.json({ success: true, team: updated });
    } catch (error) {
      console.error('Error updating team card:', error);
      res.status(500).json({ error: 'Failed to update team card' });
    }
  });

  // Teams for current user (by email or userId)
  app.get('/api/my-teams', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }
      const { email, userId } = req.query || {};
      if (!email && !userId) return res.status(400).json({ error: 'email or userId is required' });
      const teams = await teamCardDb.getTeamsForUser({ email, userId });
      res.json(teams);
    } catch (error) {
      console.error('Error reading my teams:', error);
      res.status(500).json({ error: 'Failed to read teams for user' });
    }
  });

  // CREATE team
  app.post('/api/teams', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      const newTeam = await teamsDb.createTeam(DEFAULT_COURSE_ID, req.body);
      res.status(201).json(newTeam);
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ error: 'Failed to create team' });
    }
  });

  // UPDATE team
  app.put('/api/teams/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      const teamId = req.params.id;
      const updated = await teamsDb.updateTeam(teamId, DEFAULT_COURSE_ID, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Team not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating team:', error);
      res.status(500).json({ error: 'Failed to update team' });
    }
  });

  // DELETE team
  app.delete('/api/teams/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      const teamId = req.params.id;
      const deleted = await teamsDb.deleteTeam(teamId, DEFAULT_COURSE_ID);
      if (!deleted) {
        return res.status(404).json({ error: 'Team not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({ error: 'Failed to delete team' });
    }
  });

  // ------------------------------------------------------------
  // Team Events API (Meetings & Tasks per team)
  // ------------------------------------------------------------

  // GET team events for current user's teams OR specific team via query
  // /api/team-events?teamId=... OR /api/team-events?email=user@school.edu
  app.get('/api/team-events', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }
      const { teamId, email } = req.query || {};
      let events = [];
      if (teamId) {
        events = await teamEventsDb.getEventsForTeam(teamId);
      } else if (email) {
        events = await teamEventsDb.getEventsForUserTeams(email);
      } else {
        return res.status(400).json({ error: 'teamId or email required' });
      }
      res.json(events);
    } catch (error) {
      console.error('Error fetching team events:', error);
      res.status(500).json({ error: 'Failed to fetch team events' });
    }
  });

  // POST create a team event (must be team lead of team OR professor/ta)
  app.post('/api/team-events', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }
      let { teamId, email, title, type, startsAt, repeatWeekly, audience, description } = req.body || {};
      if (!email || !title) {
        return res.status(400).json({ error: 'email and title are required' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const ctx = await classDirectoryDb.getUserCourseContextByEmail(normalizedEmail);
      if (!ctx.user || !ctx.inCourse) {
        return res.status(403).json({ error: 'User not in course' });
      }
      const primaryRole = ctx.primaryRole;
      let authorized = false;
      if (primaryRole === 'professor' || primaryRole === 'ta') {
        authorized = true;
      } else if (primaryRole === 'team_lead') {
        const { rows: leadRows } = await dbCore.query(
          `SELECT 1 FROM team_members tm
            JOIN users u ON u.id = tm.user_id
           WHERE tm.team_id = $1 AND LOWER(u.email)=LOWER($2) AND tm.is_leader = true
           LIMIT 1`,
          [teamId || null, normalizedEmail]
        );
        // If teamId not provided, try to derive it from user's leader teams
        if (!teamId) {
          const { rows: myLeadTeams } = await dbCore.query(
            `SELECT tm.team_id AS id
               FROM team_members tm
               JOIN users u ON u.id = tm.user_id
              WHERE LOWER(u.email) = LOWER($1) AND tm.is_leader = true`,
            [normalizedEmail]
          );
          if (myLeadTeams.length === 1) {
            teamId = myLeadTeams[0].id;
            authorized = true;
          } else if (myLeadTeams.length > 1) {
            return res.status(400).json({ error: 'Multiple leader teams found; specify teamId' });
          } else {
            authorized = false;
          }
        } else {
          authorized = leadRows.length > 0;
        }
      }
      if (!authorized) {
        return res.status(403).json({ error: 'Not authorized to create event for this team' });
      }
      if (!teamId) {
        return res.status(400).json({ error: 'teamId could not be resolved' });
      }
      // Sanitize audience tag: allow 'team' or 'member:<email>' only
      let audienceTag = null;
      if (audience) {
        const audLower = audience.trim().toLowerCase();
        if (audLower === 'team') {
          audienceTag = 'team';
        } else if (audLower.startsWith('member:')) {
          const targetEmail = audLower.slice('member:'.length).trim();
          // simple email format check
          if (targetEmail && targetEmail.includes('@')) {
            audienceTag = `member:${targetEmail}`;
          }
        }
      }
      const created = await teamEventsDb.createTeamEvent({
        teamId,
        creatorEmail: normalizedEmail,
        title,
        type,
        startsAt,
        repeatWeekly,
        audienceTag,
        notes: description,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating team event:', error);
      res.status(500).json({ error: 'Failed to create team event' });
    }
  });

  // ------------------------------------------------------------
  // Course Rubric API
  // ------------------------------------------------------------

  // Get the rubric for the current course
  app.get('/api/rubric', async (req, res) => {
    try {
      // Read-only: if course missing, return empty array
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }

      const items = await rubricDb.getCourseRubric(DEFAULT_COURSE_ID);
      res.json(items);
    } catch (error) {
      console.error('Error fetching rubric:', error);
      res.status(500).json({ error: 'Failed to fetch rubric' });
    }
  });

  // Create a rubric item
  app.post('/api/rubric', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const created = await rubricDb.createRubricItem(DEFAULT_COURSE_ID, req.body);
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating rubric item:', error);
      res.status(500).json({ error: error.message || 'Failed to create rubric item' });
    }
  });

  // Update a rubric item
  app.put('/api/rubric/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const { id } = req.params;
      const updated = await rubricDb.updateRubricItem(DEFAULT_COURSE_ID, id, req.body);

      if (!updated) {
        return res.status(404).json({ error: 'Rubric item not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating rubric item:', error);
      res.status(500).json({ error: error.message || 'Failed to update rubric item' });
    }
  });

  // Delete a rubric item
  app.delete('/api/rubric/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const { id } = req.params;
      const deleted = await rubricDb.deleteRubricItem(DEFAULT_COURSE_ID, id);

      if (!deleted) {
        return res.status(404).json({ error: 'Rubric item not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting rubric item:', error);
      res.status(500).json({ error: error.message || 'Failed to delete rubric item' });
    }
  });

  // ------------------------------------------------------------
  // Evaluations API (per member)
  // ------------------------------------------------------------

  app.get('/api/evaluations/:memberId', async (req, res) => {
    try {
      // Read-only: if course missing, return empty shell for the UI
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json({
          memberId: req.params.memberId,
          teamName: null,
          teamRole: null,
          reports: [],
        });
      }
      const memberId = req.params.memberId;
      // Validate UUID; if not a UUID, attempt to resolve by email, else 400
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let resolvedUserId = memberId;
      if (!uuidRegex.test(memberId)) {
        const maybeEmail = (memberId || '').trim().toLowerCase();
        if (maybeEmail.includes('@')) {
          const { rows: userRows } = await dbCore.query(
            `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
            [maybeEmail]
          );
          if (!userRows.length) {
            return res.status(404).json({ error: 'User not found for provided email' });
          }
          resolvedUserId = userRows[0].id;
        } else {
          return res.status(400).json({ error: 'memberId must be a UUID or an email' });
        }
      }
      const evalData = await evaluationsDb.getEvaluationReportsForMember(
        DEFAULT_COURSE_ID,
        resolvedUserId,
      );
      res.json(evalData);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      res.status(500).json({ error: 'Failed to fetch evaluation data' });
    }
  });

  // ------------------------------------------------------------
  // Student Weekly Evaluation API
  // ------------------------------------------------------------

  app.get('/api/student/weekly-evaluation', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Database/course not configured' });
      }

      const email = (req.query.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'email query parameter is required' });
      }

      const data = await studentWeeklyEvalDb.getWeeklyEvaluationForStudent(
        DEFAULT_COURSE_ID,
        email,
      );

      res.json(data);
    } catch (error) {
      console.error('Error fetching student weekly evaluation:', error);
      res.status(500).json({ error: 'Failed to fetch student weekly evaluation' });
    }
  });


  // ------------------------------------------------------------
  // Evaluation Notes API (per member)
  // ------------------------------------------------------------

  // Get notes for a specific member
  app.get('/api/evaluations/:memberId/notes', async (req, res) => {
    try {
      // Read-only: if course missing, return empty list
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }

      const { memberId } = req.params;
      const notes = await evalNotesDb.getNotesForMember(DEFAULT_COURSE_ID, memberId);
      res.json(notes);
    } catch (error) {
      console.error('Error fetching evaluation notes:', error);
      res.status(500).json({ error: 'Failed to fetch evaluation notes' });
    }
  });

  // Create a note for a member
  app.post('/api/evaluations/:memberId/notes', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const { memberId } = req.params;
      const created = await evalNotesDb.createNoteForMember(DEFAULT_COURSE_ID, memberId, req.body);

      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating evaluation note:', error);
      res.status(500).json({ error: error.message || 'Failed to create evaluation note' });
    }
  });



  // ------------------------------------------------------------
  // Evaluation Notes API (by email, used by Evaluation Journal page)
  // ------------------------------------------------------------

  // GET /api/eval-notes?email=student@school.edu
  app.get('/api/eval-notes', async (req, res) => {
    try {
      if (
        !ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) ||
        !DEFAULT_COURSE_ID
      ) {
        return res.json([]);
      }

      const { email, week } = req.query;
      if (!email) {
        return res.json([]);
      }

      let notes = await evalNotesDb.getNotesForUserEmail(DEFAULT_COURSE_ID, email);
      // Optional week filter (week is numeric)
      if (week) {
        const wNum = parseInt(week, 10);
        if (Number.isFinite(wNum)) {
          notes = notes.filter(n => parseInt(n.week, 10) === wNum);
        }
      }
      res.json(notes);
    } catch (error) {
      console.error('Error fetching eval notes by email:', error);
      res.status(500).json({ error: 'Failed to fetch eval notes' });
    }
  });

  // POST /api/eval-notes
  // body: { targetEmail, privateText, publicText, mode, scores, email: authorEmail }
  app.post('/api/eval-notes', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const {
        targetEmail,
        privateText,
        publicText,
        mode,
        scores,
        email: authorEmail,
        week,
      } = req.body || {};

      const created = await evalNotesDb.createNoteForUserEmail(
        DEFAULT_COURSE_ID,
        {
          targetEmail,
          privateText,
          publicText,
          mode,
          scores,
          authorEmail,
          week,
        },
      );

      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating eval note by email:', error);
      res.status(500).json({ error: error.message || 'Failed to create eval note' });
    }
  });



  // ------------------------------------------------------------
  // Work Journals API (for Evaluation Journal page)
  // ------------------------------------------------------------

  // GET /api/work-journals?forName=@student_or_team
  // GET /api/work-journals?forName=@student_or_team&email=someone@school.edu
  app.get('/api/work-journals', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }

      const { forName, email } = req.query;
      const journals = await workJournalsDb.getWorkJournals(DEFAULT_COURSE_ID, {
        forName: forName || null,
        email: email || null,
      });

      res.json(journals);
    } catch (error) {
      console.error('Error fetching work journals:', error);
      res.status(500).json({ error: 'Failed to fetch work journals' });
    }
  });

  // CREATE a new work journal entry
  app.post('/api/work-journals', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const created = await workJournalsDb.createWorkJournal(DEFAULT_COURSE_ID, req.body);
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating work journal:', error);
      res.status(500).json({ error: error.message || 'Failed to create work journal' });
    }
  });

  // UPDATE an existing work journal entry
  app.put('/api/work-journals/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const { id } = req.params;
      const updated = await workJournalsDb.updateWorkJournal(DEFAULT_COURSE_ID, id, req.body);

      if (!updated) {
        return res.status(404).json({ error: 'Work journal entry not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating work journal:', error);
      res.status(500).json({ error: error.message || 'Failed to update work journal' });
    }
  });

  // DELETE a work journal entry
  app.delete('/api/work-journals/:id', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const { id } = req.params;
      const deleted = await workJournalsDb.deleteWorkJournal(DEFAULT_COURSE_ID, id);

      if (!deleted) {
        return res.status(404).json({ error: 'Work journal entry not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting work journal:', error);
      res.status(500).json({ error: error.message || 'Failed to delete work journal' });
    }
  });

  // Reviewer view: Role-aware journals, split into new vs read
  // GET /api/work-journals/review?to=@student_or_email&email=viewer@school.edu
  // If `to` omitted, returns viewer-scoped recent journals (last 30 days)
  app.get('/api/work-journals/review', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true, errorOnMissingCourse: false }) || !DEFAULT_COURSE_ID) {
        return res.json({ newer: [], read: [] });
      }

      const rawTo = (req.query.to || '').trim();
      const viewerEmail = (req.query.email || '').trim().toLowerCase();
      if (!viewerEmail) {
        return res.status(400).json({ error: 'email is required' });
      }

      const ctx = await classDirectoryDb.getUserCourseContextByEmail(viewerEmail);
      if (!ctx.user || !ctx.inCourse) {
        return res.status(403).json({ error: 'Viewer not in course' });
      }
      const viewerId = ctx.user.id;
      const role = ctx.primaryRole; // 'professor' | 'ta' | 'team_lead' | 'student'

      let journals = [];
      if (rawTo) {
        journals = await workJournalsDb.getWorkJournals(DEFAULT_COURSE_ID, { forName: rawTo });
      } else {
        // No target provided: load recent journals for course (limit inside query) then role-filter below
        journals = await workJournalsDb.getWorkJournals(DEFAULT_COURSE_ID, {});
        // Optionally, reduce to last 30 days
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        journals = journals.filter(j => {
          const t = j.createdAt ? new Date(j.createdAt).getTime() : 0;
          return t >= cutoff;
        });
      }

      // Collect author user ids from journals
      const authorIds = Array.from(new Set(journals.map(j => j.userId).filter(Boolean)));

      // Pre-compute allowed authors by role
      let allowedAuthorSet = new Set();
      if (role === 'professor') {
        allowedAuthorSet = new Set(authorIds);
      } else if (role === 'ta') {
        // TA can see journals of students in teams they are assigned to
        const { rows: taTeams } = await dbCore.query(
          `SELECT team_id FROM team_ta_assignments WHERE ta_user_id = $1`,
          [viewerId]
        );
        const taTeamIds = taTeams.map(r => r.team_id);
        if (taTeamIds.length) {
          const { rows } = await dbCore.query(
            `SELECT DISTINCT tm.user_id
               FROM team_members tm
              WHERE tm.team_id = ANY($1::uuid[]) AND tm.user_id = ANY($2::uuid[])`,
            [taTeamIds, authorIds]
          );
          allowedAuthorSet = new Set(rows.map(r => r.user_id));
        }
      } else if (role === 'team_lead') {
        // Team lead can see journals for members of teams they lead (including themself)
        const { rows: leadTeams } = await dbCore.query(
          `SELECT team_id FROM team_members WHERE user_id = $1 AND is_leader = true`,
          [viewerId]
        );
        const leadTeamIds = leadTeams.map(r => r.team_id);
        const allowed = new Set([viewerId]);
        if (leadTeamIds.length) {
          const { rows } = await dbCore.query(
            `SELECT DISTINCT tm.user_id
               FROM team_members tm
              WHERE tm.team_id = ANY($1::uuid[])`,
            [leadTeamIds]
          );
          rows.forEach(r => allowed.add(r.user_id));
        }
        allowedAuthorSet = allowed;
      } else {
        // Other roles: default deny
        allowedAuthorSet = new Set();
      }

      // Build a read map for viewer
      const journalIds = journals.map(j => j.id);
      const readSet = await workJournalsDb.getReadMapForViewer(viewerId, journalIds);

      function mentionYouFlag(j) {
        const who = (j.reachOutTo || '').toLowerCase();
        if (role === 'professor') return who === 'professor';
        if (role === 'ta') return who === 'ta';
        if (role === 'team_leader') return who === 'team_leader';
        return false;
      }

      // Filter journals based on allowed authors, and visibility for team lead
      const filtered = journals.filter(j => {
        if (!allowedAuthorSet.has(j.userId)) return false;
        if (role === 'team_lead' && j.userId !== viewerId && (j.visibility || '').toLowerCase() === 'private') {
          return false; // TL cannot see others' private journals
        }
        return true;
      }).map(j => ({
        id: j.id,
        createdAt: j.createdAt,
        userId: j.userId,
        userName: j.userName,
        userEmail: j.userEmail,
        teamName: j.teamName,
        visibility: j.visibility,
        content: j.content,
        sentimentSelf: j.sentimentSelf,
        sentimentTeam: j.sentimentTeam,
        sentimentCourse: j.sentimentCourse,
        moodText: j.moodText,
        reachOutTo: j.reachOutTo,
        mentionYou: mentionYouFlag(j),
        isRead: readSet.has(j.id),
      }));

      const newer = filtered.filter(j => !j.isRead);
      const read = filtered.filter(j => j.isRead);
      res.json({ newer, read });
    } catch (error) {
      console.error('Error loading reviewer journals:', error);
      res.status(500).json({ newer: [], read: [], error: 'Failed to load journals for review' });
    }
  });

  // Mark a journal as read by a viewer (staff)
  app.post('/api/work-journals/:id/read', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: false })) return;
      const { id } = req.params;
      const { email } = req.body || {};
      const viewerEmail = (email || '').trim().toLowerCase();
      if (!id || !viewerEmail) {
        return res.status(400).json({ success: false, message: 'id and email required' });
      }
      const ctx = await classDirectoryDb.getUserCourseContextByEmail(viewerEmail);
      if (!ctx.user) return res.status(404).json({ success: false, message: 'Viewer not found' });
      await workJournalsDb.markJournalRead(id, ctx.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking journal read:', error);
      res.status(500).json({ success: false, message: 'Failed to mark read' });
    }
  });

  // ------------------------------------------------------------
  // Work Journal Replies API
  // ------------------------------------------------------------

  // Get replies for a work journal entry
  app.get('/api/work-journals/:id/replies', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json([]);
      }

      const { id } = req.params;
      const replies = await journalRepliesDb.getRepliesForJournal(id);
      res.json(replies);
    } catch (error) {
      console.error('Error fetching work journal replies:', error);
      res.status(500).json({ error: 'Failed to fetch work journal replies' });
    }
  });

  // Create a reply for a work journal entry
  app.post('/api/work-journals/:id/replies', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }

      const { id } = req.params;
      const created = await journalRepliesDb.createReplyForJournal(id, req.body);
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating work journal reply:', error);
      res.status(500).json({ error: error.message || 'Failed to create work journal reply' });
    }
  });

  // ------------------------------------------------------------
  // Student Weekly Evaluation API
  // ------------------------------------------------------------

  // GET /api/student/weekly-evaluation?email=student@school.edu
  app.get('/api/student/weekly-evaluation', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({
          error: 'Course/database not configured for weekly evaluation',
        });
      }

      const email = (req.query.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'email query param is required' });
      }

      const data = await studentWeeklyDb.getWeeklyEvaluation(DEFAULT_COURSE_ID, email);

      if (!data) {
        // No such user (or not in users table)
        return res.json({
          user: null,
          reports: [],
          notes: [],
          journals: [],
        });
      }

      res.json(data);
    } catch (error) {
      console.error('Error fetching student weekly evaluation:', error);
      res.status(500).json({
        user: null,
        reports: [],
        notes: [],
        journals: [],
        error: 'Failed to fetch weekly evaluation',
      });
    }
  });



  // ------------------------------------------------------------
  // Class directory (course + staff + teams) & events
  // ------------------------------------------------------------

  // Main class directory payload
  app.get('/api/class_directory', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json({
          course: null,
          instructors: [],
          TAs: [],
          tutors: [],
          Teams: [],
        });
      }
      const data = await classDirectoryDb.getClassDirectory();
      res.json(data);
    } catch (error) {
      console.error('Error reading class directory:', error);
      res.status(500).json({ error: 'Failed to read class directory' });
    }
  });

  // Course info only
  app.get('/api/class-directory/course', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json(null);
      }
      const course = await classDirectoryDb.getCourseOverview();
      res.json(course);
    } catch (error) {
      console.error('Error reading course info:', error);
      res.status(500).json({ error: 'Failed to read course info' });
    }
  });

  // Upsert course description for the default course
  // body: { description }
  app.put('/api/class-directory/course/description', async (req, res) => {
    try {
      if (!ensureDb(res, { requireCourse: true }) || !DEFAULT_COURSE_ID) {
        return;
      }

      const { description } = req.body || {};
      const descText = (description || '').trim();
      if (!descText) {
        return res.status(400).json({ error: 'description is required' });
      }

      await dbCore.query(
        `INSERT INTO course_info (course_id, description, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (course_id)
         DO UPDATE SET description = EXCLUDED.description, updated_at = now()`,
        [DEFAULT_COURSE_ID, descText]
      );

      const course = await classDirectoryDb.getCourseOverview();
      return res.json({ success: true, course });
    } catch (error) {
      console.error('Error upserting course description:', error);
      return res.status(500).json({ error: 'Failed to save course description' });
    }
  });

  // Individual staff lists
  app.get('/api/class-directory/instructors', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json([]);
      }
      const instructors = await classDirectoryDb.getStaffByRole('professor');
      res.json(instructors);
    } catch (error) {
      console.error('Error reading instructors:', error);
      res.status(500).json({ error: 'Failed to read instructors' });
    }
  });

  app.get('/api/class-directory/tas', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json([]);
      }
      const tas = await classDirectoryDb.getStaffByRole('ta');
      res.json(tas);
    } catch (error) {
      console.error('Error reading TAs:', error);
      res.status(500).json({ error: 'Failed to read TAs' });
    }
  });

  app.get('/api/class-directory/tutors', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json([]);
      }
      const tutors = await classDirectoryDb.getStaffByRole('tutor');
      res.json(tutors);
    } catch (error) {
      console.error('Error reading tutors:', error);
      res.status(500).json({ error: 'Failed to read tutors' });
    }
  });

  app.get('/api/class-directory/teams', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json([]);
      }
      const teams = await classDirectoryDb.getCourseTeams();
      res.json(teams);
    } catch (error) {
      console.error('Error reading class directory teams:', error);
      res.status(500).json({ error: 'Failed to read class directory teams' });
    }
  });

  // Class events
  app.get('/api/class-directory/events', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json([]);
      }
      const events = await eventsDb.getEvents();
      res.json(events);
    } catch (error) {
      console.error('Error reading events:', error);
      res.status(500).json({ error: 'Failed to read events' });
    }
  });

  // Aggregated class directory payload (fewer round trips, parallel queries)
  app.get('/api/class-directory/summary', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json({
          course: null,
          instructors: [],
          tas: [],
          tutors: [],
          teams: [],
          events: [],
        });
      }

      const [course, instructors, tas, tutors, teams, events] = await Promise.all([
        classDirectoryDb.getCourseOverview(),
        classDirectoryDb.getStaffByRole('professor'),
        classDirectoryDb.getStaffByRole('ta'),
        classDirectoryDb.getStaffByRole('tutor'),
        classDirectoryDb.getCourseTeams(),
        eventsDb.getEvents(),
      ]);

      res.json({ course, instructors, tas, tutors, teams, events });
    } catch (error) {
      console.error('Error building class directory summary:', error);
      res.status(500).json({ error: 'Failed to build class directory summary' });
    }
  });

  app.post('/api/class-directory/events', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return; // ensureDb already sent 500
      }
      const event = await eventsDb.createEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  app.put('/api/class-directory/events/:id', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }
      const id = req.params.id;
      const updated = await eventsDb.updateEvent(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  });

  app.delete('/api/class-directory/events/:id', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }
      const id = req.params.id;
      const deleted = await eventsDb.deleteEvent(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  // ------------------------------------------------------------
  // Members API (for task tracker & student directory)
  // ------------------------------------------------------------

  app.get('/api/members', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json([]);
      }
      const members = await membersDb.getMembers();
      res.json(members);
    } catch (error) {
      console.error('Error reading members:', error);
      res.status(500).json({ error: 'Failed to read members' });
    }
  });

  // ------------------------------------------------------------
  // Tasks API (task board)
  // ------------------------------------------------------------

  app.get('/api/tasks', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json({});
      }
      const board = await tasksDb.getTasksBoard();
      res.json(board);
    } catch (error) {
      console.error('Error reading tasks:', error);
      res.status(500).json({ error: 'Failed to read tasks' });
    }
  });

  app.put('/api/tasks', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }
      const board = req.body;
      await tasksDb.overwriteTasksBoard(board);
      res.json({ message: 'Tasks updated' });
    } catch (error) {
      console.error('Error updating tasks:', error);
      res.status(500).json({ error: 'Failed to update tasks' });
    }
  });

  // ------------------------------------------------------------
  // Attendance API (professor & student)
  // ------------------------------------------------------------

  // GET all attendance sessions for the default course
  app.get('/api/attendance/sessions', async (req, res) => {
    try {
      // Read-only: if DB/course missing, return empty list
      if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
        return res.json([]);
      }

      const sessions = await attendanceDb.getSessions(DEFAULT_COURSE_ID);
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching attendance sessions:', error);
      res.status(500).json({ error: 'Failed to fetch attendance sessions' });
    }
  });

  // CREATE a new attendance session (professor)
  app.post('/api/attendance/sessions', async (req, res) => {
    try {
      if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const { durationMinutes } = req.body || {};
      const session = await attendanceDb.createSession(DEFAULT_COURSE_ID, {
        durationMinutes,
      });

      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating attendance session:', error);
      res.status(500).json({ error: error.message || 'Failed to create attendance session' });
    }
  });

  // Optional: GET a single session + attendance records (for debugging)
  app.get('/api/attendance/sessions/:id', async (req, res) => {
    try {
      if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const sessionId = req.params.id;
      const session = await attendanceDb.getSessionWithAttendance(
        DEFAULT_COURSE_ID,
        sessionId,
      );

      if (!session) {
        return res.status(404).json({ error: 'Attendance session not found' });
      }

      res.json(session);
    } catch (error) {
      console.error('Error fetching attendance session:', error);
      res.status(500).json({ error: 'Failed to fetch attendance session' });
    }
  });

  // Student marks themselves present using a code
  app.post('/api/attendance/mark', async (req, res) => {
    try {
      if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
        return res.json({
          success: false,
          message: 'Attendance not configured for this course',
        });
      }

      const { code, email } = req.body || {};
      const result = await attendanceDb.markAttendanceByCode(
        DEFAULT_COURSE_ID,
        code,
        email,
      );

      // Always 200 with success flag; frontend uses result.success/message
      res.json(result);
    } catch (error) {
      console.error('Error marking attendance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark attendance',
      });
    }
  });

  // Get attendance history for a student by email
  app.get('/api/attendance/history', async (req, res) => {
    try {
      if (!ensureDb(res) || !DEFAULT_COURSE_ID) {
        return res.json({
          sessions: [],
          presentCount: 0,
          totalSessions: 0,
        });
      }

      const { email } = req.query;
      const history = await attendanceDb.getHistoryByEmail(DEFAULT_COURSE_ID, email);

      res.json(history);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      res.status(500).json({
        sessions: [],
        presentCount: 0,
        totalSessions: 0,
        error: 'Failed to fetch attendance history',
      });
    }
  });

  // ------------------------------------------------------------
  // Profile Page
  // ------------------------------------------------------------
  // Profile API (create/update and fetch)

  // Create or update a user profile
  app.post('/api/profile', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return; // ensureDb already responded
      }
      const profile = req.body || {};
      if (!profile.user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }
      const result = await profileDb.createOrUpdateProfile(profile);
      return res.status(201).json(result.rows ? result.rows[0] : result);
    } catch (error) {
      console.error('Error saving profile:', error);
      return res.status(500).json({ error: error.message || 'Failed to save profile' });
    }
  });

  // Fetch a user profile by user_id or email
  app.get('/api/profile', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return; // ensureDb already responded
      }
      const { user_id, email } = req.query || {};
      if (!user_id && !email) {
        return res.status(400).json({ error: 'user_id or email is required' });
      }
      let profile;
      if (user_id) {
        profile = await profileDb.getProfileByUserId(user_id);
      } else {
        profile = await profileDb.getProfileByEmail(email);
      }
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      return res.json(profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch profile' });
    }
  });

  


  // ------------------------------------------------------------
  // GitHub API integration
  // ------------------------------------------------------------
  // Note: GitHub API functions are now in ./services/githubApi.js
  // Keeping old function definitions for backward compatibility during migration
  // TODO: Remove these and use githubApi module directly

  // Fetch GitHub issues for configured repo (REST API)
  async function fetchGitHubIssues(owner, repo, token = '') {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Conductor-App',
    };
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Filter out pull requests (they have pull_request property)
    return data.filter((issue) => !issue.pull_request);
  }

  // Fetch GitHub issues from a Project v2 (GraphQL API)
  // Supports both direct project ID and organization + project number
  async function fetchGitHubProjectIssues(projectId, token, orgName = null, projectNumber = null) {
    if (!token) {
      throw new Error('GitHub token is required for Project API access');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Conductor-App',
    };

    let query, variables;

    // If org_name and project_number are provided, use organization-based query
    if (orgName && projectNumber !== null) {
      query = `
        query($orgLogin: String!, $projectNumber: Int!, $first: Int!) {
          organization(login: $orgLogin) {
            projectV2(number: $projectNumber) {
              id
              title
              items(first: $first) {
                nodes {
                  id
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                        name
                      }
                    }
                  }
                  content {
                    ... on Issue {
                      id
                      number
                      title
                      url
                      state
                      body
                      assignees(first: 10) {
                        nodes {
                          login
                        }
                      }
                      labels(first: 10) {
                        nodes {
                          name
                        }
                      }
                      milestone {
                        dueOn
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      variables = {
        orgLogin: orgName,
        projectNumber: parseInt(projectNumber, 10),
        first: 100,
      };
    } else if (projectId) {
      // Use direct project ID query (existing method)
      query = `
        query($projectId: ID!, $first: Int!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              id
              title
              items(first: $first) {
                nodes {
                  id
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        field {
                          ... on ProjectV2FieldCommon {
                            name
                          }
                        }
                        name
                      }
                    }
                  }
                  content {
                    ... on Issue {
                      id
                      number
                      title
                      url
                      state
                      body
                      assignees(first: 10) {
                        nodes {
                          login
                        }
                      }
                      labels(first: 10) {
                        nodes {
                          name
                        }
                      }
                      milestone {
                        dueOn
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      variables = {
        projectId: projectId,
        first: 100,
      };
    } else {
      throw new Error('Either project_id or org_name + project_number must be provided');
    }

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub GraphQL API error: ${response.status} ${response.statusText} - ${text}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    // Handle both organization-based and direct ID queries
    let project;
    if (orgName && projectNumber !== null) {
      project = result.data?.organization?.projectV2;
    } else {
      project = result.data?.node;
    }

    if (!project || !project.items) {
      throw new Error('Invalid project or project not found. Check organization name, project number, or project ID.');
    }

    // Extract issues from project items
    const issues = [];
    for (const item of project.items.nodes) {
      if (item.content) {
        // Check if content is an Issue (has number field which is unique to issues)
        if (item.content.number !== undefined) {
          const issue = item.content;
          
          // Find status field value from project item
          let statusFieldValue = null;
          if (item.fieldValues && item.fieldValues.nodes) {
            const statusField = item.fieldValues.nodes.find(
              (fv) => fv && fv.field && fv.field.name && 
              (fv.field.name.toLowerCase().includes('status') || 
               fv.field.name.toLowerCase().includes('state'))
            );
            if (statusField && statusField.name) {
              statusFieldValue = statusField.name;
            }
          }

          // Normalize GraphQL response to match REST API format for mapping function
          const normalizedIssue = {
            number: issue.number,
            title: issue.title,
            url: issue.url,
            html_url: issue.url, // GraphQL uses 'url', REST uses 'html_url'
            state: issue.state,
            body: issue.body,
            milestone: issue.milestone ? { due_on: issue.milestone.dueOn } : null,
            projectStatus: statusFieldValue,
            // Normalize labels: GraphQL returns { nodes: [...] }, REST returns [...]
            labels: issue.labels && issue.labels.nodes 
              ? issue.labels.nodes.map(l => ({ name: l.name }))
              : (issue.labels || []),
            // Normalize assignees: GraphQL returns { nodes: [...] }, REST returns single assignee
            assignee: issue.assignees && issue.assignees.nodes && issue.assignees.nodes.length > 0
              ? { login: issue.assignees.nodes[0].login }
              : null,
            assignees: issue.assignees, // Keep original for reference
          };

          issues.push(normalizedIssue);
        }
      }
    }

    return issues;
  }

  // Map a GitHub issue to our task format
  function mapGitHubIssueToTask(issue, members = []) {
    // Determine status bucket based on project status field, issue state, and labels
    let group = 'todo';
    
    // First, check if we have a project status field (from GitHub Projects)
    if (issue.projectStatus) {
      const status = issue.projectStatus.toLowerCase();
      if (status.includes('done') || status.includes('complete') || status.includes('closed')) {
        group = 'done';
      } else if (status.includes('progress') || status.includes('doing') || status.includes('in progress')) {
        group = 'progress';
      } else if (status.includes('todo') || status.includes('backlog') || status.includes('not started')) {
        group = 'todo';
      }
    }
    
    // Fall back to issue state and labels if no project status
    if (group === 'todo' && issue.state === 'closed') {
      group = 'done';
    } else if (group === 'todo' && issue.labels && issue.labels.some((label) => {
      const name = typeof label === 'string' ? label : (label.name || '').toLowerCase();
      return name.includes('in-progress') || name.includes('progress') || name.includes('doing');
    })) {
      group = 'progress';
    }

    // Default assignee is GitHub login or "None"
    let assignee = 'None';
    // Handle both REST API format (single assignee) and GraphQL format (assignees array)
    const assigneeData = issue.assignee || (issue.assignees && issue.assignees.nodes && issue.assignees.nodes[0]);
    if (assigneeData) {
  
  
      const login = assigneeData.login || assigneeData;
      assignee = login;

      // Try to map to a known member name if possible
      const matchedMember = members.find(
        (m) =>
          (m.name && m.name.toLowerCase().includes(login.toLowerCase())) ||
          (m.initials && m.initials.toLowerCase() === login.toLowerCase()),
      );
      if (matchedMember) {
        assignee = matchedMember.name;
      }
    }

    // Priority badge from labels (high/medium/low)
    let badge = 'medium';
    const labels = issue.labels || (issue.labels && issue.labels.nodes ? issue.labels.nodes : []);
    if (labels && labels.some((label) => {
      const name = typeof label === 'string' ? label : (label.name || '').toLowerCase();
      return name.includes('high');
    })) {
      badge = 'high';
    } else if (labels && labels.some((label) => {
      const name = typeof label === 'string' ? label : (label.name || '').toLowerCase();
      return name.includes('low');
    })) {
      badge = 'low';
    }

    // Due date from milestone if present
    let due = 'TBD';
    if (issue.milestone && (issue.milestone.due_on || issue.milestone.dueOn)) {
      const dueDate = new Date(issue.milestone.due_on || issue.milestone.dueOn);
      due = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return {
      title: issue.title,
      badge,
      due: issue.state === 'closed' ? 'Completed' : due,
      assignee,
      githubIssueNumber: issue.number,
      githubUrl: issue.html_url || issue.url,
      githubState: issue.state,
      group,
    };
  }



  // Create a GitHub issue from a task
  async function createGitHubIssue(owner, repo, token, task) {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Conductor-App',
    };
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const body = {
      title: task.title || 'Task from Conductor',
      body: [
        'Created from Conductor task board.',
        '',
        `Status: ${task.group || 'todo'}`,
        `Assignee (Conductor): ${task.assignee || 'None'}`,
        `Due: ${task.due || 'TBD'}`,
      ].join('\n'),
    };

    // Optional: label from badge (low/medium/high)
    if (task.badge) {
      body.labels = [String(task.badge)];
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `GitHub issue create error: ${response.status} ${response.statusText} ${text}`,
      );
    }

    const data = await response.json();
    // data.number, data.html_url, data.state, etc.
    return data;
  }


  // GitHub config
  app.get('/api/github/config', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return res.json({ owner: '', repo: '', token: '' });
      }
      const config = await githubDb.getGithubConfig();
      res.json(config);
    } catch (error) {
      console.error('Error reading GitHub config:', error);
      res.status(500).json({ error: 'Failed to read GitHub config' });
    }
  });

  app.post('/api/github/config', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }
      const { owner, repo, token, project_id, org_name, project_number } = req.body;
      const saved = await githubDb.upsertGithubConfig({ 
        owner, 
        repo, 
        token, 
        project_id, 
        org_name, 
        project_number: project_number ? parseInt(project_number, 10) : null 
      });
      res.json(saved);
    } catch (error) {
      console.error('Error saving GitHub config:', error);
      res.status(500).json({ error: 'Failed to save GitHub config' });
    }
  });

  // Get raw GitHub issues mapped to tasks (does not modify board)
  app.get('/api/github/issues', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }

      const config = await githubDb.getGithubConfig();
      
      let issues = [];
      
      // If org_name and project_number are configured, fetch from GitHub Projects
      if (config.org_name && config.project_number !== null) {
        if (!config.token) {
          return res.status(400).json({
            error: 'GitHub token is required for Project API access.',
          });
        }
        issues = await fetchGitHubProjectIssues(null, config.token, config.org_name, config.project_number);
      } else if (config.project_id) {
        // Use direct project ID
        if (!config.token) {
          return res.status(400).json({
            error: 'GitHub token is required for Project API access.',
          });
        }
        issues = await fetchGitHubProjectIssues(config.project_id, config.token);
      } else if (config.owner && config.repo) {
        // Fall back to repository issues
        issues = await fetchGitHubIssues(config.owner, config.repo, config.token);
      } else {
        return res.status(400).json({
          error: 'GitHub not configured. Please set org_name/project_number, project_id, or owner/repo.',
        });
      }

      const members = await membersDb.getMembers();
      const mappedTasks = issues.map((issue) => mapGitHubIssueToTask(issue, members));

      res.json({
        issues: mappedTasks,
        count: mappedTasks.length,
      });
    } catch (error) {
      console.error('Error fetching GitHub issues:', error);
      res.status(500).json({ error: 'Failed to fetch GitHub issues', message: error.message });
    }
  });

  // Sync GitHub issues into our tasks board under a dedicated story
  app.post('/api/github/sync', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }

      const config = await githubDb.getGithubConfig();
      
      let issues = [];
      let githubStoryName = '';
      
      // If org_name and project_number are configured, fetch from GitHub Projects
      if (config.org_name && config.project_number !== null) {
        if (!config.token) {
          return res.status(400).json({
            error: 'GitHub token is required for Project API access.',
          });
        }
        issues = await fetchGitHubProjectIssues(null, config.token, config.org_name, config.project_number);
        githubStoryName = `GitHub Project: ${config.org_name}/project-${config.project_number}`;
      } else if (config.project_id) {
        // Use direct project ID
        if (!config.token) {
          return res.status(400).json({
            error: 'GitHub token is required for Project API access.',
          });
        }
        issues = await fetchGitHubProjectIssues(config.project_id, config.token);
        githubStoryName = `GitHub Project: ${config.project_id.substring(0, 12)}...`;
      } else if (config.owner && config.repo) {
        // Fall back to repository issues
        issues = await fetchGitHubIssues(config.owner, config.repo, config.token);
        githubStoryName = `GitHub: ${config.owner}/${config.repo}`;
      } else {
        return res.status(400).json({
          error: 'GitHub not configured. Please set org_name/project_number, project_id, or owner/repo.',
        });
      }

      const members = await membersDb.getMembers();
      const mappedTasks = issues.map((issue) => mapGitHubIssueToTask(issue, members));

      // Load current tasks board
      const currentTasks = await tasksDb.getTasksBoard();

      // Ensure a story exists for GitHub issues
      if (!currentTasks[githubStoryName]) {
        currentTasks[githubStoryName] = { todo: [], progress: [], done: [] };
      }

      // Group mapped tasks into todo/progress/done based on computed group
      const groupedTasks = { todo: [], progress: [], done: [] };
      mappedTasks.forEach((task) => {
        const group = task.group || 'todo';
        groupedTasks[group].push(task);
      });

      // Update board and persist
      currentTasks[githubStoryName] = groupedTasks;
      await tasksDb.overwriteTasksBoard(currentTasks);

      res.json({
        message: 'GitHub issues synced successfully',
        synced: mappedTasks.length,
        story: githubStoryName,
      });
    } catch (error) {
      console.error('Error syncing GitHub issues:', error);
      res.status(500).json({
        error: 'Failed to sync GitHub issues',
        message: error.message,
      });
    }
  });

  // Update GitHub project issues to match task board positions
  // Note: Uses functions from ./services/githubApi.js
  app.post('/api/github/update', async (req, res) => {
    // Ensure we always return JSON, even on errors
    const sendError = (status, message) => {
      if (!res.headersSent) {
        return res.status(status).json({ error: message });
      }
    };

    try {
      if (!ensureDb(res)) {
        return sendError(500, 'Database not configured');
      }

      const config = await githubDb.getGithubConfig();
      
      // Check if using GitHub Projects (required for status updates)
      if (!config.org_name && !config.project_id) {
        return res.status(400).json({
          error: 'GitHub Projects not configured. Please configure org_name/project_number or project_id.',
        });
      }

      if (!config.token) {
        return res.status(400).json({
          error: 'GitHub token is required for Project API access.',
        });
      }

      // Load current tasks board from DB
      const board = await tasksDb.getTasksBoard();
      
      // Find GitHub story (could be different formats)
      let githubStoryName = null;
      let story = null;
      
      if (config.org_name && config.project_number !== null) {
        githubStoryName = `GitHub Project: ${config.org_name}/project-${config.project_number}`;
        story = board[githubStoryName];
      }
      
      if (!story && config.project_id) {
        githubStoryName = `GitHub Project: ${config.project_id.substring(0, 12)}...`;
        story = board[githubStoryName];
      }
      
      if (!story && config.owner && config.repo) {
        githubStoryName = `GitHub: ${config.owner}/${config.repo}`;
        story = board[githubStoryName];
      }

      if (!story) {
        return res.status(400).json({
          error: `No GitHub story found in task board. Please sync GitHub issues first.`,
        });
      }

      // Fetch project items with their IDs using the service module
      const project = await githubApi.fetchProjectItemsWithIds(
        config.project_id,
        config.token,
        config.org_name,
        config.project_number
      );

      // Find status field ID and options
      const statusField = project.fields?.nodes?.find(
        (field) => field && field.name && 
        (field.name.toLowerCase().includes('status') || field.name.toLowerCase().includes('state'))
      );

      if (!statusField || !statusField.id) {
        return res.status(400).json({
          error: 'Status field not found in GitHub project. Please ensure your project has a status field.',
        });
      }

      // Get status field options (if available from the query)
      let statusOptions = statusField.options || [];

      // Get all possible status field values (we'll need to query for options)
      // For now, we'll map our columns to common status values
      const statusMapping = {
        'todo': ['Todo', 'To Do', 'Not Started', 'Backlog'],
        'progress': ['In Progress', 'InProgress', 'Doing', 'Active'],
        'done': ['Done', 'Completed', 'Complete', 'Closed'],
      };

      // Create a map of issue number -> project item ID
      const issueToItemMap = new Map();
      for (const item of project.items?.nodes || []) {
        if (item.content && item.content.number !== undefined) {
          issueToItemMap.set(item.content.number, item.id);
        }
      }

      // If options weren't included in the initial query, fetch them separately
      if (!statusOptions || statusOptions.length === 0) {
        const fieldOptionsQuery = `
          query($projectId: ID!, $fieldId: ID!) {
            node(id: $projectId) {
              ... on ProjectV2 {
                field(id: $fieldId) {
                  ... on ProjectV2SingleSelectField {
                    options {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        `;

        const fieldOptionsResponse = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Conductor-App',
          },
          body: JSON.stringify({
            query: fieldOptionsQuery,
            variables: { projectId: project.id, fieldId: statusField.id },
          }),
        });

        if (fieldOptionsResponse.ok) {
          const fieldOptionsResult = await fieldOptionsResponse.json();
          if (!fieldOptionsResult.errors && fieldOptionsResult.data?.node?.field?.options) {
            statusOptions = fieldOptionsResult.data.node.field.options;
          }
        }
      }

      // Helper function to find status option ID by name
      const findStatusOptionId = (columnName) => {
        const possibleNames = statusMapping[columnName] || [columnName];
        for (const name of possibleNames) {
          const option = statusOptions.find(
            opt => opt.name && opt.name.toLowerCase() === name.toLowerCase()
          );
          if (option) return option.id;
        }
        // If exact match not found, try partial match
        for (const name of possibleNames) {
          const option = statusOptions.find(
            opt => opt.name && opt.name.toLowerCase().includes(name.toLowerCase())
          );
          if (option) return option.id;
        }
        return null;
      };

      let updated = 0;
      const groups = ['todo', 'progress', 'done'];

      // Update each task's status in GitHub
      for (const group of groups) {
        const tasks = story[group] || [];
        for (const task of tasks) {
          if (!task.githubIssueNumber) continue;

          const itemId = issueToItemMap.get(task.githubIssueNumber);
          if (!itemId) {
            console.warn(`Project item not found for issue #${task.githubIssueNumber}`);
            continue;
          }

          const statusOptionId = findStatusOptionId(group);
          if (!statusOptionId) {
            console.warn(`Status option not found for column "${group}"`);
            continue;
          }

          try {
            await githubApi.updateProjectItemStatus(
              project.id,
              itemId,
              statusField.id,
              statusOptionId,
              config.token
            );
            updated += 1;
          } catch (error) {
            console.error(`Error updating issue #${task.githubIssueNumber}:`, error);
            // Continue with other updates
          }
        }
      }

      if (!res.headersSent) {
        res.json({
          message: 'Updated GitHub project issues',
          updated,
          total: updated,
        });
      }
    } catch (error) {
      console.error('Error updating GitHub issues:', error);
      console.error('Error stack:', error.stack);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to update GitHub issues',
          message: error.message || 'Unknown error occurred',
        });
      }
    }
  });

  // Push local tasks in the GitHub story that don't have an issue number yet
  app.post('/api/github/push', async (req, res) => {
    try {
      if (!ensureDb(res)) {
        return;
      }

      const config = await githubDb.getGithubConfig();
      if (!config.owner || !config.repo) {
        return res.status(400).json({
          error: 'GitHub repository not configured',
        });
      }

      // Load current tasks board from DB
      const board = await tasksDb.getTasksBoard();
      const githubStoryName = `GitHub: ${config.owner}/${config.repo}`;
      const story = board[githubStoryName];

      if (!story) {
        return res.status(400).json({
          error: `No story named "${githubStoryName}" found in the task board.`,
        });
      }

      const groups = ['todo', 'progress', 'done'];
      let created = 0;

      for (const group of groups) {
        const tasks = story[group] || [];
        for (const task of tasks) {
          // Only create issues for tasks that are not yet linked
          if (task.githubIssueNumber != null) continue;

          const issue = await createGitHubIssue(
            config.owner,
            config.repo,
            config.token,
            { ...task, group },
          );

          task.githubIssueNumber = issue.number;
          task.githubUrl = issue.html_url;
          task.githubState = issue.state;
          created += 1;
        }
      }

      // Persist updated board (with issue numbers)
      await tasksDb.overwriteTasksBoard(board);

      res.json({
        message: 'Pushed new tasks to GitHub',
        created,
        story: githubStoryName,
      });
    } catch (error) {
      console.error('Error pushing tasks to GitHub:', error);
      res.status(500).json({
        error: 'Failed to push tasks to GitHub',
        message: error.message,
      });
    }
  });


  // ------------------------------------------------------------
  // Root route
  // ------------------------------------------------------------

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  });

  // ------------------------------------------------------------
  // Static assets (registered last)
  // ------------------------------------------------------------
  app.use(express.static(path.join(__dirname, '../frontend/public')));
  app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

  // ------------------------------------------------------------
  // Server bootstrap
  // ------------------------------------------------------------

  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  }

  module.exports = app;
