// app/backend/db/classDirectory.js
const db = require('./index');

/**
 * Single current course ID from env (used as fallback if no classCode is provided).
 * In your .env it should be:
 *   DEFAULT_COURSE_ID=22222222-2222-2222-2222-222222222222
 */
function getCurrentCourseId() {
  return process.env.DEFAULT_COURSE_ID || null;
}

/**
 * Normalize a course code like "CSE 210" → "CSE210"
 */
function normalizeCourseCode(raw) {
  return (raw || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Find a course by code (e.g. 'CSE210').
 * Returns { id, code, title } or null if not found.
 */
async function findCourseForLogin(rawCode) {
  const key = normalizeCourseCode(rawCode);
  if (!key) return null;

  const { rows } = await db.query(
    `
      SELECT c.id, c.code, c.title
      FROM courses c
      WHERE REPLACE(UPPER(c.code), ' ', '') = $1
      ORDER BY c.created_at DESC
      LIMIT 1
    `,
    [key]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    id: row.id,
    code: row.code,
    title: row.title,
  };
}

/** Course + term info for the "directory" page */
async function getCourseOverview(courseIdOverride) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return null;

  const { rows } = await db.query(
    `
      SELECT
        c.id,
        c.code,
        c.title,
        t.code AS term_code,
        t.name AS term_name,
        ci.description
      FROM courses c
      JOIN terms t
        ON t.id = c.term_id
      LEFT JOIN course_info ci
        ON ci.course_id = c.id
      WHERE c.id = $1
      LIMIT 1
    `,
    [courseId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    id: row.id,
    course_code: row.code,
    title: row.title,
    term_code: row.term_code,
    term_name: row.term_name,
    description: row.description || '',
  };
}
/** Staff list for a given role key (professor, ta, tutor) */
async function getStaffByRole(courseId, roleKey) {
  const { rows } = await db.query(
    `
      SELECT
        u.id,
        u.display_name,
        up.photo_url,
        up.pronouns,
        up.phone,
        up.email          AS profile_email,
        up.availability_notes,
        up.public_link
      FROM role_assignments ra
      JOIN roles r
        ON r.id = ra.role_id
      JOIN users u
        ON u.id = ra.user_id
      LEFT JOIN user_profiles up
        ON up.user_id = u.id
      WHERE ra.scope_type = 'course'
        AND ra.scope_id = $1
        AND r.key = $2
      ORDER BY u.display_name ASC
    `,
    [courseId, roleKey]
  );

  return rows.map((r) => ({
    id: r.id,
    staff_picture: r.photo_url || '',
    photo_url: r.photo_url || '',
    name: r.display_name || r.profile_email || '',
    role: roleKey,
    pronouns: r.pronouns || '',
    contact: r.phone || '',
    phone: r.phone || '',
    office_hours: r.availability_notes || '',
    public_link: r.public_link || '',
    email: r.profile_email || '',
  }));
}

/** All staff grouped by role for the directory view */
async function getAllStaff(courseIdOverride) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return { instructors: [], TAs: [], tutors: [] };

  const [instructors, TAs, tutors] = await Promise.all([
    getStaffByRole(courseId, 'professor'),
    getStaffByRole(courseId, 'ta'),
    getStaffByRole(courseId, 'tutor'),
  ]);

  return { instructors, TAs, tutors };
}


/** Teams for the current course */
async function getCourseTeams(courseIdOverride) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return [];

  const { rows } = await db.query(
    `
      SELECT
        t.id,
        t.code,
        t.name,
        t.display_number,
        t.status,
        t.description
      FROM teams t
      WHERE t.course_id = $1
      ORDER BY t.display_number::int NULLS LAST, t.created_at ASC
    `,
    [courseId]
  );

  return rows.map((r) => ({
    id: r.id,
    teamNumber: r.display_number,
    team_name: r.name,
    code: r.code,
    status: r.status || '',
    description: r.description || '',
  }));
}


/** Aggregated class directory payload */
async function getClassDirectory(courseIdOverride) {
  const [course, staff, teams] = await Promise.all([
    getCourseOverview(courseIdOverride),
    getAllStaff(courseIdOverride),
    getCourseTeams(courseIdOverride),
  ]);

  return {
    course,
    instructors: staff.instructors,
    TAs: staff.TAs,
    tutors: staff.tutors,
    Teams: teams,
  };
}


/**
 * Compute a user's course context from email and (optionally) classCode.
 *
 * options: { classCode?: string }
 */
async function getUserCourseContextByEmail(emailRaw, options = {}) {
  const email = (emailRaw || '').trim().toLowerCase();
  const { classCode } = options;

  let courseMeta = null;

  // 0) Decide which course we’re talking about
  if (classCode && classCode.trim()) {
    // Caller supplied a class code → look it up in courses table
    courseMeta = await findCourseForLogin(classCode);
    if (!courseMeta) {
      // No course matches that class code
      return {
        user: null,
        courseId: null,
        courseCode: null,
        courseName: null,
        roles: [],
        inCourse: false,
        isTeamLead: false,
        teamLeadTeams: [],
        primaryRole: null,
      };
    }
  } else {
    // No class code provided → fall back to DEFAULT_COURSE_ID
    const currentCourseId = getCurrentCourseId();
    if (!currentCourseId || !email) {
      return {
        user: null,
        courseId: null,
        courseCode: null,
        courseName: null,
        roles: [],
        inCourse: false,
        isTeamLead: false,
        teamLeadTeams: [],
        primaryRole: null,
      };
    }

    const { rows } = await db.query(
      `
        SELECT c.id, c.code, c.title
        FROM courses c
        WHERE c.id = $1
        LIMIT 1
      `,
      [currentCourseId]
    );

    if (!rows.length) {
      return {
        user: null,
        courseId: null,
        courseCode: null,
        courseName: null,
        roles: [],
        inCourse: false,
        isTeamLead: false,
        teamLeadTeams: [],
        primaryRole: null,
      };
    }

    const row = rows[0];
    courseMeta = {
      id: row.id,
      code: row.code,
      title: row.title,
    };
  }

  const courseId = courseMeta.id;

  if (!courseId || !email) {
    return {
      user: null,
      courseId: null,
      courseCode: null,
      courseName: null,
      roles: [],
      inCourse: false,
      isTeamLead: false,
      teamLeadTeams: [],
      primaryRole: null,
    };
  }

  // 1) Lookup user by email
  const { rows: userRows } = await db.query(
    `
      SELECT id, email, display_name
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
    `,
    [email]
  );

  if (!userRows.length) {
    // Email is totally unknown
    return {
      user: null,
      courseId,
      courseCode: courseMeta.code,
      courseName: courseMeta.title,
      roles: [],
      inCourse: false,
      isTeamLead: false,
      teamLeadTeams: [],
      primaryRole: null,
    };
  }

  const user = userRows[0];

  // 2) Course roles (professor, ta, tutor, student, etc.) in THIS course
  const { rows: roleRows } = await db.query(
    `
      SELECT r.key
      FROM roles r
      JOIN role_assignments ra ON ra.role_id = r.id
      WHERE ra.user_id = $1
        AND ra.scope_type = 'course'
        AND ra.scope_id = $2
    `,
    [user.id, courseId]
  );
  const roles = roleRows.map((r) => r.key);

  // 3) Is this user actually in the course roster?
  const { rows: membershipRows } = await db.query(
    `
      SELECT 1
      FROM course_memberships
      WHERE user_id = $1
        AND course_id = $2
      LIMIT 1
    `,
    [user.id, courseId]
  );
  const inCourse = membershipRows.length > 0;

  // 4) Team lead? (team_members.is_leader = true)
  const { rows: tlRows } = await db.query(
    `
      SELECT t.id, t.code, t.name
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = $1
        AND t.course_id = $2
        AND tm.is_leader = TRUE
    `,
    [user.id, courseId]
  );
  const isTeamLead = tlRows.length > 0;

  // 5) Choose primaryRole for routing
  let primaryRole = 'student';
  if (roles.includes('admin')) {
    primaryRole = 'admin';
  } else if (roles.includes('professor')) {
    primaryRole = 'professor';
  } else if (roles.includes('ta')) {
    primaryRole = 'ta';
  } else if (roles.includes('tutor')) {
    primaryRole = 'tutor';
  } else if (isTeamLead) {
    primaryRole = 'team_lead';
  } else if (!inCourse) {
    primaryRole = null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name || user.email,
    },
    courseId,
    courseCode: courseMeta.code,
    courseName: courseMeta.title,
    roles,
    inCourse,
    isTeamLead,
    teamLeadTeams: tlRows,
    primaryRole,
  };
}

module.exports = {
  getCurrentCourseId,
  getCourseOverview,
  getStaffByRole,
  getAllStaff,
  getCourseTeams,
  getClassDirectory,
  getUserCourseContextByEmail,
  // these helpers are exported in case you want them elsewhere later
  normalizeCourseCode,
  findCourseForLogin,
};