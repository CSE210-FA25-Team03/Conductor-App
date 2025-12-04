// backend/db/classDirectory.js
const db = require('./index');

/**
 * For now assume a single current course ID from env.
 * Later we can derive from auth/user/session.
 */
function getCurrentCourseId() {
  return process.env.DEFAULT_COURSE_ID; // uuid from your DB
}

/** Course + term info */
async function getCourseOverview() {
  const courseId = getCurrentCourseId();
  if (!courseId) return null;

  const { rows } = await db.query(
    `
    SELECT c.id,
           c.code,
           c.title,
           t.code AS term_code,
           t.name AS term_name
    FROM courses c
    JOIN terms t ON c.term_id = t.id
    WHERE c.id = $1
    `,
    [courseId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    course_code: row.code,
    term_year: row.term_code,
    title: row.title,
  };
}

async function getStaffByRole(roleKey) {
  const courseId = getCurrentCourseId();
  if (!courseId) return [];

  const { rows } = await db.query(
    `
        SELECT u.id,
          u.display_name AS name,
          u.pronouns,
          COALESCE(up.email, u.email) AS email,
           up.photo_url AS staff_picture,
           up.phone AS contact,
           up.availability_notes AS office_hours,
           up.public_link AS public_link
    FROM role_assignments ra
    JOIN roles r ON ra.role_id = r.id
    JOIN users u ON ra.user_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE ra.scope_type = 'course'
      AND ra.scope_id = $1
      AND r.key = $2
    ORDER BY u.display_name
    `,
    [courseId, roleKey],
  );

  return rows.map((r) => ({
    id: r.id,
    staff_picture: r.staff_picture || '',
    photo_url: r.staff_picture || '',
    name: r.name,
    role: roleKey,
    pronouns: r.pronouns || '',
    contact: r.contact || '',
    phone: r.contact || '',
    office_hours: r.office_hours || '',
    public_link: r.public_link || '',
    email: r.email || '',
  }));
}

async function getAllStaff() {
  const [instructors, TAs, tutors] = await Promise.all([
    getStaffByRole('professor'),
    getStaffByRole('ta'),
    getStaffByRole('tutor'),
  ]);

  return { instructors, TAs, tutors };
}

// ==== Teams for class directory ====

async function getCourseTeams() {
  const courseId = getCurrentCourseId();
  if (!courseId) return [];

  const { rows } = await db.query(
    `
    SELECT t.id,
           t.code AS "teamNumber",
           t.name,
           t.status,
           t.description,
           t.display_number AS "displayNumber"
    FROM teams t
    WHERE t.course_id = $1
    ORDER BY t.created_at ASC
    `,
    [courseId],
  );
  return rows;
}

// This is the main shape used by /api/class_directory
async function getClassDirectory() {
  const [course, staff, teams] = await Promise.all([
    getCourseOverview(),
    getAllStaff(),
    getCourseTeams(),
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
 * Resolve a user's course context (roles, team lead, etc.) from email.
 * Used by the login flow so users can't "choose" roles manually.
 */
async function getUserCourseContextByEmail(emailRaw) {
  const courseId = getCurrentCourseId();
  const email = (emailRaw || '').trim().toLowerCase();

  if (!courseId || !email) {
    return {
      user: null,
      courseId: null,
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
    [email],
  );

  if (!userRows.length) {
    return {
      user: null,
      courseId,
      roles: [],
      inCourse: false,
      isTeamLead: false,
      teamLeadTeams: [],
      primaryRole: null,
    };
  }

  const user = userRows[0];

  // 2) Course roles (professor, ta, tutor, student, etc.)
  const { rows: roleRows } = await db.query(
    `
    SELECT r.key
    FROM roles r
    JOIN role_assignments ra ON ra.role_id = r.id
    WHERE ra.user_id = $1
      AND ra.scope_type = 'course'
      AND ra.scope_id = $2
    `,
    [user.id, courseId],
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
    [user.id, courseId],
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
    [user.id, courseId],
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
    // student but also a team lead
    primaryRole = 'team_lead';
  } else if (!inCourse) {
    // they exist in users but are not in this course roster
    primaryRole = null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name || user.email,
    },
    courseId,
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
};
