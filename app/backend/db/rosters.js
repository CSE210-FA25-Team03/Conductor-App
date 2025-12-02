// backend/db/rosters.js
// Handles importing class + staff rosters into the DB.

const db = require('./index');

/**
 * Very simple CSV parser:
 * - expects first line to be headers
 * - splits by comma (no support for embedded commas/quotes)
 */
function parseCsv(text) {
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase());

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Ensure there is a role with a given key (e.g. 'student', 'ta', 'professor')
 * Returns the role id.
 */
async function ensureRole(roleKey, label) {
  const { rows } = await db.query(
    `
    INSERT INTO roles (key, label)
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label
    RETURNING id
    `,
    [roleKey, label],
  );
  return rows[0].id;
}

/**
 * Upsert a user by email, returning user id.
 */
async function upsertUserByEmail(email, { given_name, family_name, display_name }) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) return null;

  const nameFromParts = [given_name, family_name].filter(Boolean).join(' ').trim();
  const finalDisplayName = display_name || nameFromParts || normalizedEmail;

  const { rows } = await db.query(
    `
    INSERT INTO users (email, display_name, given_name, family_name)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, users.display_name),
      given_name   = COALESCE(EXCLUDED.given_name, users.given_name),
      family_name  = COALESCE(EXCLUDED.family_name, users.family_name),
      updated_at   = now()
    RETURNING id
    `,
    [normalizedEmail, finalDisplayName || null, given_name || null, family_name || null],
  );

  return rows[0].id;
}

/**
 * Ensure a course_memberships row exists.
 */
async function ensureCourseMembership(courseId, userId, rosterSource) {
  if (!courseId || !userId) return;

  await db.query(
    `
    INSERT INTO course_memberships (course_id, user_id, roster_source)
    VALUES ($1, $2, $3)
    ON CONFLICT (course_id, user_id) DO UPDATE SET
      status        = 'active',
      roster_source = EXCLUDED.roster_source
    `,
    [courseId, userId, rosterSource || null],
  );
}

/**
 * Ensure a course-scoped role assignment (professor/ta/tutor/student).
 */
async function ensureRoleAssignment(userId, roleKey, courseId) {
  if (!userId || !roleKey || !courseId) return;

  // Get or create the role row
  let roleId;
  {
    const { rows } = await db.query(`SELECT id FROM roles WHERE key = $1`, [roleKey]);
    if (rows.length) {
      roleId = rows[0].id;
    } else {
      roleId = await ensureRole(roleKey, roleKey.charAt(0).toUpperCase() + roleKey.slice(1));
    }
  }

  await db.query(
    `
    INSERT INTO role_assignments (user_id, role_id, scope_type, scope_id)
    VALUES ($1, $2, 'course', $3)
    ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING
    `,
    [userId, roleId, courseId],
  );
}

/**
 * Import the *student* roster (class roster CSV).
 * Expected headers (case-insensitive):
 *   - email (required)
 *   - first_name (optional)
 *   - last_name (optional)
 *   - display_name (optional)
 */
async function importClassRoster(courseId, csvText) {
  const rows = parseCsv(csvText);
  let inserted = 0;

  for (const row of rows) {
    const email =
      row.email || row['e-mail'] || row['ucsd email'] || row['school email'] || null;
    if (!email) continue;

    const given_name =
      row.first_name || row.firstname || row['first name'] || row.given_name || null;
    const family_name =
      row.last_name || row.lastname || row['last name'] || row.family_name || null;
    const display_name =
      row.display_name || row.name || row['full name'] || row['student name'] || null;

    const userId = await upsertUserByEmail(email, {
      given_name,
      family_name,
      display_name,
    });

    if (!userId) continue;

    await ensureCourseMembership(courseId, userId, 'class_roster');
    await ensureRoleAssignment(userId, 'student', courseId);
    inserted += 1;
  }

  return inserted;
}

/**
 * Import the *staff* roster CSV.
 * Expected headers (case-insensitive):
 *   - email (required)
 *   - role  (required: professor | ta | tutor)
 *   - first_name, last_name, display_name (optional)
 */
async function importStaffRoster(courseId, csvText) {
  const rows = parseCsv(csvText);
  let inserted = 0;

  for (const row of rows) {
    const email = row.email || row['e-mail'] || null;
    if (!email) continue;

    const rawRole = (row.role || row.position || '').toLowerCase();
    let roleKey = null;
    if (rawRole.includes('prof')) {
      roleKey = 'professor';
    } else if (rawRole.includes('ta')) {
      roleKey = 'ta';
    } else if (rawRole.includes('tutor')) {
      roleKey = 'tutor';
    }

    if (!roleKey) {
      // Skip unknown staff roles
      continue;
    }

    const given_name =
      row.first_name || row.firstname || row['first name'] || row.given_name || null;
    const family_name =
      row.last_name || row.lastname || row['last name'] || row.family_name || null;
    const display_name =
      row.display_name || row.name || row['full name'] || row['staff name'] || null;

    const userId = await upsertUserByEmail(email, {
      given_name,
      family_name,
      display_name,
    });

    if (!userId) continue;

    await ensureCourseMembership(courseId, userId, 'staff_roster');
    await ensureRoleAssignment(userId, roleKey, courseId);
    inserted += 1;
  }

  return inserted;
}

/**
 * Main entry used by the API.
 * Returns { classRows, staffRows }
 */
async function importRosters(courseId, { classRosterCsv, staffRosterCsv }) {
  const result = {
    classRows: 0,
    staffRows: 0,
  };

  if (classRosterCsv && classRosterCsv.trim().length > 0) {
    result.classRows = await importClassRoster(courseId, classRosterCsv);
  }

  if (staffRosterCsv && staffRosterCsv.trim().length > 0) {
    result.staffRows = await importStaffRoster(courseId, staffRosterCsv);
  }

  return result;
}

module.exports = {
  importRosters,
};
