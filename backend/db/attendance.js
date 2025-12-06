// backend/db/attendance.js
//
// Attendance helpers aligned with your schema:
//
// attendance_sessions (
//   id uuid PK DEFAULT gen_random_uuid(),
//   course_id uuid NOT NULL REFERENCES courses(id),
//   created_by uuid NOT NULL REFERENCES users(id),
//   code text NOT NULL,
//   type text NOT NULL CHECK (type IN (...)),
//   live_minutes int NOT NULL DEFAULT 10,
//   created_at timestamptz NOT NULL DEFAULT now(),
//   expires_at timestamptz NOT NULL
// )
//
// attendances (
//   id uuid PK DEFAULT gen_random_uuid(),
//   session_id uuid NOT NULL REFERENCES attendance_sessions(id),
//   user_id uuid NOT NULL REFERENCES users(id),
//   marked_at timestamptz NOT NULL DEFAULT now(),
//   success boolean NOT NULL DEFAULT true,
//   source text NOT NULL DEFAULT 'self',
//   UNIQUE (session_id, user_id)
// )

const db = require('./index');

function mapSessionRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    courseId: row.course_id,
    code: row.code,
    type: row.type,
    liveMinutes: row.live_minutes,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    presentCount:
      row.present_count != null ? Number(row.present_count) : 0,
  };
}

/**
 * Get all attendance sessions for a course, with present counts.
 */
async function getSessions(courseId) {
  if (!courseId) return [];

  const { rows } = await db.query(
    `
    SELECT
      s.id,
      s.course_id,
      s.code,
      s.type,
      s.live_minutes,
      s.created_at,
      s.expires_at,
      COUNT(a.*) FILTER (WHERE a.success IS TRUE) AS present_count
    FROM attendance_sessions s
    LEFT JOIN attendances a ON a.session_id = s.id
    WHERE s.course_id = $1
    GROUP BY s.id
    ORDER BY s.created_at DESC
    `,
    [courseId],
  );

  return rows.map(mapSessionRow);
}

/**
 * Pick a created_by user for an attendance session.
 *
 * For dev/testing we:
 * - Prefer a user who has a 'professor' role scoped to this course
 * - Fallback to the first course_memberships record
 */
async function pickCreatorUserId(courseId) {
  // Try to find a professor for this course
  const { rows: profRows } = await db.query(
    `
    SELECT u.id AS user_id
    FROM users u
    JOIN role_assignments ra ON ra.user_id = u.id
    JOIN roles r ON r.id = ra.role_id
    WHERE ra.scope_type = 'course'
      AND ra.scope_id = $1
      AND r.key = 'professor'
    ORDER BY u.created_at ASC
    LIMIT 1
    `,
    [courseId],
  );

  if (profRows.length) {
    return profRows[0].user_id;
  }

  // Fallback: any course member
  const { rows: memberRows } = await db.query(
    `
    SELECT user_id
    FROM course_memberships
    WHERE course_id = $1
    ORDER BY created_at ASC
    LIMIT 1
    `,
    [courseId],
  );

  if (!memberRows.length) {
    throw new Error(
      'No users found in this course to use as created_by for attendance_sessions',
    );
  }

  return memberRows[0].user_id;
}

/**
 * Create a new attendance session with a random code and expiration.
 * data: { durationMinutes }
 */
async function createSession(courseId, data = {}) {
  if (!courseId) {
    throw new Error('Course ID is required to create attendance sessions');
  }

  const creatorUserId = await pickCreatorUserId(courseId);

  const durationRaw = parseInt(data.durationMinutes, 10);
  const liveMinutes = Number.isFinite(durationRaw)
    ? Math.max(1, Math.min(60, durationRaw))
    : 10;

  // Generate a 6-character code (A–Z, 0–9, no ambiguous chars)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + liveMinutes * 60 * 1000);

  const { rows } = await db.query(
    `
    INSERT INTO attendance_sessions (
      course_id,
      created_by,
      code,
      type,
      live_minutes,
      created_at,
      expires_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING
      id,
      course_id,
      code,
      type,
      live_minutes,
      created_at,
      expires_at
    `,
    [
      courseId,
      creatorUserId,
      code,
      'class_meeting', // valid type per your CHECK constraint
      liveMinutes,
      now.toISOString(),
      expiresAt.toISOString(),
    ],
  );

  return mapSessionRow({ ...rows[0], present_count: 0 });
}

/**
 * Get a single session with its attendance records.
 * (Not currently used by frontend, but useful for debugging.)
 */
async function getSessionWithAttendance(courseId, sessionId) {
  if (!courseId || !sessionId) return null;

  const { rows: sessionRows } = await db.query(
    `
    SELECT
      id,
      course_id,
      code,
      type,
      live_minutes,
      created_at,
      expires_at
    FROM attendance_sessions
    WHERE id = $1
      AND course_id = $2
    `,
    [sessionId, courseId],
  );

  if (!sessionRows.length) return null;

  const session = mapSessionRow(sessionRows[0]);

  const { rows: attendanceRows } = await db.query(
    `
    SELECT
      a.id,
      a.session_id,
      a.user_id,
      a.marked_at,
      a.success,
      a.source,
      u.email,
      u.display_name
    FROM attendances a
    JOIN users u ON u.id = a.user_id
    WHERE a.session_id = $1
    ORDER BY a.marked_at ASC
    `,
    [sessionId],
  );

  session.records = attendanceRows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    email: row.email,
    name: row.display_name,
    markedAt: row.marked_at,
    success: row.success,
    source: row.source,
  }));

  return session;
}

/**
 * Mark attendance for a student given a code + email.
 * Returns:
 *   { success, message?, reason?, session? }
 */
async function markAttendanceByCode(courseId, codeRaw, emailRaw) {
  if (!courseId) {
    return {
      success: false,
      reason: 'db_not_configured',
      message: 'Course ID is missing',
    };
  }

  const code = (codeRaw || '').trim().toUpperCase();
  const email = (emailRaw || '').trim().toLowerCase();

  if (!code || !email) {
    return {
      success: false,
      reason: 'invalid_input',
      message: 'Code and email are required',
    };
  }

  // 1) Lookup user by email
  const { rows: userRows } = await db.query(
    `
    SELECT id
    FROM users
    WHERE LOWER(email) = $1
    LIMIT 1
    `,
    [email],
  );

  if (!userRows.length) {
    return {
      success: false,
      reason: 'unknown_user',
      message:
        'No user found for that email. The student must exist in the users table.',
    };
  }

  const userId = userRows[0].id;

  // 2) Find the most recent session with this code for this course
  const { rows: sessionRows } = await db.query(
    `
    SELECT
      s.id,
      s.course_id,
      s.code,
      s.type,
      s.live_minutes,
      s.created_at,
      s.expires_at
    FROM attendance_sessions s
    WHERE s.course_id = $1
      AND UPPER(s.code) = $2
    ORDER BY s.created_at DESC
    LIMIT 1
    `,
    [courseId, code],
  );

  if (!sessionRows.length) {
    return {
      success: false,
      reason: 'code_not_found',
      message: 'No session found for that code in this course.',
    };
  }

  const sessionRow = sessionRows[0];

  // 3) Expiry check in JS (clearer errors)
  const now = new Date();
  const expiresAt = new Date(sessionRow.expires_at);
  if (now > expiresAt) {
    return {
      success: false,
      reason: 'expired',
      message: 'This code has expired. Ask your instructor for a new one.',
    };
  }

  // 4) Upsert attendance row
  await db.query(
    `
    INSERT INTO attendances (session_id, user_id, marked_at, success, source)
    VALUES ($1,$2,NOW(),TRUE,'self')
    ON CONFLICT (session_id, user_id)
    DO UPDATE SET
      marked_at = EXCLUDED.marked_at,
      success   = EXCLUDED.success,
      source    = EXCLUDED.source
    `,
    [sessionRow.id, userId],
  );

  const session = mapSessionRow(sessionRow);

  return {
    success: true,
    session,
  };
}

/**
 * Get attendance history for a student by email.
 * Returns:
 *   { sessions: [{ sessionId, createdAt, status }], presentCount, totalSessions }
 */
async function getHistoryByEmail(courseId, emailRaw) {
  if (!courseId) {
    return { sessions: [], presentCount: 0, totalSessions: 0 };
  }

  const email = (emailRaw || '').trim().toLowerCase();
  if (!email) {
    return { sessions: [], presentCount: 0, totalSessions: 0 };
  }

  // 1) Lookup user
  const { rows: userRows } = await db.query(
    `
    SELECT id
    FROM users
    WHERE LOWER(email) = $1
    LIMIT 1
    `,
    [email],
  );

  if (!userRows.length) {
    return { sessions: [], presentCount: 0, totalSessions: 0 };
  }

  const userId = userRows[0].id;

  // 2) All sessions + whether this user was present
  const { rows } = await db.query(
    `
    SELECT
      s.id AS session_id,
      s.created_at AS session_created_at,
      s.expires_at,
      s.code,
      s.type,
      COALESCE(a.success, FALSE) AS success
    FROM attendance_sessions s
    LEFT JOIN attendances a
      ON a.session_id = s.id
      AND a.user_id = $2
    WHERE s.course_id = $1
    ORDER BY s.created_at ASC
    `,
    [courseId, userId],
  );

  const sessions = rows.map((row) => ({
    sessionId: row.session_id,
    createdAt: row.session_created_at,
    status: row.success ? 'present' : 'absent',
  }));

  const totalSessions = sessions.length;
  const presentCount = sessions.filter(
    (s) => (s.status || '').toLowerCase() === 'present',
  ).length;

  return {
    sessions,
    presentCount,
    totalSessions,
  };
}

module.exports = {
  getSessions,
  createSession,
  getSessionWithAttendance,
  markAttendanceByCode,
  getHistoryByEmail,
};
