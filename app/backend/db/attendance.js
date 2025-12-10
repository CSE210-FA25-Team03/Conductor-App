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
    teamId: row.team_id || null,
    liveMinutes: row.live_minutes,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    presentCount:
      row.present_count != null ? Number(row.present_count) : 0,
  };
}

/**
 * Get all attendance sessions for a course, with present counts.
 * @param {string} courseId - Course ID
 * @param {string} typeFilter - Optional: filter by type ('class_meeting' or 'team_meeting')
 * @param {string} teamIdFilter - Optional: filter by team_id (for team leads to see only their team's sessions)
 */
async function getSessions(courseId, typeFilter = null, teamIdFilter = null) {
  if (!courseId) return [];

  let query = `
    SELECT
      s.id,
      s.course_id,
      s.code,
      s.type,
      s.team_id,
      s.live_minutes,
      s.created_at,
      s.expires_at,
      COUNT(a.*) FILTER (WHERE a.success IS TRUE) AS present_count
    FROM attendance_sessions s
    LEFT JOIN attendances a ON a.session_id = s.id
    WHERE s.course_id = $1
  `;
  const params = [courseId];
  let paramIndex = 2;

  if (typeFilter) {
    query += ` AND s.type = $${paramIndex}`;
    params.push(typeFilter);
    paramIndex++;
  }

  if (teamIdFilter) {
    query += ` AND s.team_id = $${paramIndex}`;
    params.push(teamIdFilter);
    paramIndex++;
  }

  query += `
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `;

  const { rows } = await db.query(query, params);

  return rows.map(mapSessionRow);
}

/**
 * Get team ID for a team lead user in a course.
 */
async function getTeamIdForTeamLead(courseId, userId) {
  const { rows } = await db.query(
    `
    SELECT t.id
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE t.course_id = $1
      AND tm.user_id = $2
      AND tm.is_leader = TRUE
    ORDER BY t.created_at ASC
    LIMIT 1
    `,
    [courseId, userId],
  );
  return rows.length ? rows[0].id : null;
}

/**
 * Create a new attendance session with a random code and expiration.
 * data: { durationMinutes, type, teamId, createdBy }
 */
async function createSession(courseId, data = {}) {
  if (!courseId) {
    throw new Error('Course ID is required to create attendance sessions');
  }

  const creatorUserId = data.createdBy || null;
  if (!creatorUserId) {
    throw new Error('createdBy user ID is required');
  }

  const sessionType = data.type || 'class_meeting';
  const teamId = data.teamId || null;

  // Validate: team_meeting requires teamId
  if (sessionType === 'team_meeting' && !teamId) {
    throw new Error('teamId is required for team_meeting sessions');
  }

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
      team_id,
      live_minutes,
      created_at,
      expires_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING
      id,
      course_id,
      code,
      type,
      team_id,
      live_minutes,
      created_at,
      expires_at
    `,
    [
      courseId,
      creatorUserId,
      code,
      sessionType,
      teamId,
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
 * @param {string} courseId - Course ID
 * @param {string} codeRaw - Attendance code
 * @param {string} emailRaw - User email
 * @param {string} expectedType - Expected session type ('class_meeting' or 'team_meeting')
 */
async function markAttendanceByCode(courseId, codeRaw, emailRaw, expectedType = null) {
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
  // If expectedType is provided, filter by type
  let query = `
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
  `;
  const queryParams = [courseId, code];
  
  if (expectedType) {
    query += ` AND s.type = $3`;
    queryParams.push(expectedType);
  }
  
  query += ` ORDER BY s.created_at DESC LIMIT 1`;

  const { rows: sessionRows } = await db.query(query, queryParams);

  if (!sessionRows.length) {
    if (expectedType) {
      return {
        success: false,
        reason: 'code_type_mismatch',
        message: `No ${expectedType === 'class_meeting' ? 'class meeting' : 'team meeting'} session found for that code. Make sure you're using the correct code type.`,
      };
    }
    return {
      success: false,
      reason: 'code_not_found',
      message: 'No session found for that code in this course.',
    };
  }

  const sessionRow = sessionRows[0];

  // 3) Validate type matches expected type (if provided)
  if (expectedType && sessionRow.type !== expectedType) {
    return {
      success: false,
      reason: 'code_type_mismatch',
      message: `This code is for a ${sessionRow.type === 'class_meeting' ? 'class meeting' : 'team meeting'}, not a ${expectedType === 'class_meeting' ? 'class meeting' : 'team meeting'}. Please use the correct code.`,
    };
  }

  // 4) Expiry check in JS (clearer errors)
  const now = new Date();
  const expiresAt = new Date(sessionRow.expires_at);
  if (now > expiresAt) {
    return {
      success: false,
      reason: 'expired',
      message: 'This code has expired. Ask your instructor for a new one.',
    };
  }

  // 5) Upsert attendance row
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
 *   { 
 *     sessions: [{ sessionId, createdAt, status, type }], 
 *     presentCount, 
 *     totalSessions,
 *     classMeetings: { sessions, presentCount, totalSessions },
 *     teamMeetings: { sessions, presentCount, totalSessions }
 *   }
 */
async function getHistoryByEmail(courseId, emailRaw) {
  const emptyResponse = {
    sessions: [],
    presentCount: 0,
    totalSessions: 0,
    classMeetings: { sessions: [], presentCount: 0, totalSessions: 0 },
    teamMeetings: { sessions: [], presentCount: 0, totalSessions: 0 },
  };

  if (!courseId) {
    return emptyResponse;
  }

  const email = (emailRaw || '').trim().toLowerCase();
  if (!email) {
    return emptyResponse;
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
    return emptyResponse;
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
    type: row.type || 'class_meeting', // Include session type
  }));

  // Separate sessions by type
  // Handle both 'class' and 'class_meeting' for backward compatibility
  const classSessions = sessions.filter((s) => 
    s.type === 'class_meeting' || s.type === 'class'
  );
  const teamSessions = sessions.filter((s) => 
    s.type === 'team_meeting' || s.type === 'group_meeting'
  );

  // Calculate statistics for all sessions
  const totalSessions = sessions.length;
  const presentCount = sessions.filter(
    (s) => (s.status || '').toLowerCase() === 'present',
  ).length;

  // Calculate statistics for class meetings
  const classTotalSessions = classSessions.length;
  const classPresentCount = classSessions.filter(
    (s) => (s.status || '').toLowerCase() === 'present',
  ).length;

  // Calculate statistics for team meetings
  const teamTotalSessions = teamSessions.length;
  const teamPresentCount = teamSessions.filter(
    (s) => (s.status || '').toLowerCase() === 'present',
  ).length;

  return {
    sessions,
    presentCount,
    totalSessions,
    // Separated statistics
    classMeetings: {
      sessions: classSessions,
      presentCount: classPresentCount,
      totalSessions: classTotalSessions,
    },
    teamMeetings: {
      sessions: teamSessions,
      presentCount: teamPresentCount,
      totalSessions: teamTotalSessions,
    },
  };
}

/**
 * Get attendance plot data for a team by 7-day periods.
 * Returns: { periods: [...], averageRate, totalMembers, totalPeriods }
 */
async function getAttendancePlot(courseId, teamId, sessionType) {
  if (!courseId || !teamId || !sessionType) {
    return { periods: [], averageRate: 0, totalMembers: 0, totalPeriods: 0 };
  }

  // Get team members
  const { rows: memberRows } = await db.query(
    `
    SELECT tm.user_id
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE t.id = $1 AND t.course_id = $2
    `,
    [teamId, courseId],
  );
  const teamMemberIds = memberRows.map((r) => r.user_id);
  const totalMembers = teamMemberIds.length;
  if (totalMembers === 0) {
    return { periods: [], averageRate: 0, totalMembers: 0, totalPeriods: 0 };
  }

  // Get all sessions of this type for this team/course
  const { rows: sessionRows } = await db.query(
    `
    SELECT s.id, s.created_at
    FROM attendance_sessions s
    WHERE s.course_id = $1
      AND s.type = $2
      AND (s.team_id = $3 OR ($2 = 'class_meeting' AND s.team_id IS NULL))
    ORDER BY s.created_at ASC
    `,
    [courseId, sessionType, teamId],
  );

  if (sessionRows.length === 0) {
    return { periods: [], averageRate: 0, totalMembers, totalPeriods: 0 };
  }

  // Get all attendance records for these sessions and team members
  const sessionIds = sessionRows.map((r) => r.id);
  const { rows: attendanceRows } = await db.query(
    `
    SELECT a.session_id, a.user_id, s.created_at
    FROM attendances a
    JOIN attendance_sessions s ON s.id = a.session_id
    WHERE a.session_id = ANY($1::uuid[])
      AND a.user_id = ANY($2::uuid[])
      AND a.success = TRUE
    `,
    [sessionIds, teamMemberIds],
  );

  // Group sessions by 7-day periods
  const periodMap = new Map();
  sessionRows.forEach((session) => {
    const date = new Date(session.created_at);
    const periodStart = new Date(date);
    periodStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    periodStart.setHours(0, 0, 0, 0);
    const periodKey = periodStart.toISOString().split('T')[0];

    if (!periodMap.has(periodKey)) {
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodMap.set(periodKey, {
        startDate: periodKey,
        endDate: periodEnd.toISOString().split('T')[0],
        sessionIds: [],
        presentMembers: new Set(),
      });
    }
    periodMap.get(periodKey).sessionIds.push(session.id);
  });

  // Count present members per period
  attendanceRows.forEach((row) => {
    const sessionDate = new Date(row.created_at);
    const periodStart = new Date(sessionDate);
    periodStart.setDate(sessionDate.getDate() - sessionDate.getDay());
    periodStart.setHours(0, 0, 0, 0);
    const periodKey = periodStart.toISOString().split('T')[0];

    const period = periodMap.get(periodKey);
    if (period && period.sessionIds.includes(row.session_id)) {
      period.presentMembers.add(row.user_id);
    }
  });

  // Calculate rates and format periods
  const periods = Array.from(periodMap.values())
    .map((period) => {
      const presentCount = period.presentMembers.size;
      const attendanceRate = totalMembers > 0
        ? Math.round((presentCount / totalMembers) * 100)
        : 0;

      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      const label = formatPeriodLabel(start, end);

      return {
        startDate: period.startDate,
        endDate: period.endDate,
        label,
        attendanceRate,
        presentCount,
        totalMembers,
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const totalPeriods = periods.length;
  const averageRate =
    totalPeriods > 0
      ? Math.round(
          periods.reduce((sum, p) => sum + p.attendanceRate, 0) / totalPeriods,
        )
      : 0;

  return { periods, averageRate, totalMembers, totalPeriods };
}

function formatPeriodLabel(start, end) {
  const startMonth = start.toLocaleString('en-US', { month: 'short' });
  const endMonth = end.toLocaleString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

module.exports = {
  getSessions,
  createSession,
  getSessionWithAttendance,
  markAttendanceByCode,
  getHistoryByEmail,
  getAttendancePlot,
  getTeamIdForTeamLead,
};
