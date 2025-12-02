// backend/db/workJournals.js
//
// DB helpers for work journals + simple query helpers used by:
//   - /work_journal page (students creating and viewing their own entries)
//   - evaluation_journal page (staff viewing journals for a student/team)
//
// Schema (from schema.sql):
//   work_journals (
//     id                uuid PK DEFAULT gen_random_uuid(),
//     course_id         uuid NOT NULL REFERENCES courses(id),
//     user_id           uuid NOT NULL REFERENCES users(id),
//     team_id           uuid REFERENCES teams(id) ON DELETE SET NULL,
//     ta_user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
//     content           text NOT NULL,
//     sentiment_self    smallint NOT NULL,
//     sentiment_team    smallint NOT NULL,
//     sentiment_course  smallint NOT NULL,
//     mood_text         text,
//     reach_out_to      text CHECK (reach_out_to IN ('none','professor','ta','team_leader')),
//     visibility        text NOT NULL DEFAULT 'private',
//     created_at        timestamptz NOT NULL DEFAULT now()
//   );

const db = require('./index');

// ------------------------------------------------------------
// Utility mappers
// ------------------------------------------------------------

function mapJournalRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    courseId: row.course_id,
    userId: row.user_id,
    teamId: row.team_id,
    taUserId: row.ta_user_id,
    content: row.content,
    sentimentSelf: row.sentiment_self,
    sentimentTeam: row.sentiment_team,
    sentimentCourse: row.sentiment_course,
    moodText: row.mood_text,
    reachOutTo: row.reach_out_to,
    visibility: row.visibility,
    createdAt: row.created_at,
    // convenience fields for UI:
    userName: row.user_name || row.display_name || null,
    userEmail: row.user_email || row.email || null,
    teamName: row.team_name || null,
  };
}

// ------------------------------------------------------------
// Helper: resolve a user_id from payload (userId or email)
// ------------------------------------------------------------

async function resolveUserId(courseId, payload = {}) {
  // 1) Use explicit userId if provided
  if (payload.userId) {
    return payload.userId;
  }

  // 2) Use email if provided
  const email = (payload.email || '').trim().toLowerCase();
  if (email) {
    const { rows } = await db.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email],
    );

    if (rows.length) {
      return rows[0].id;
    }
  }

  // 3) Dev fallback: any course member (first one we find)
  if (courseId) {
    const { rows } = await db.query(
      `
      SELECT u.id
      FROM users u
      JOIN course_memberships cm ON cm.user_id = u.id
      WHERE cm.course_id = $1
      ORDER BY cm.created_at ASC
      LIMIT 1
      `,
      [courseId],
    );
    if (rows.length) {
      return rows[0].id;
    }
  }

  // If we still have nothing, surface a clear error.
  throw new Error('userId is required to create a work journal entry');
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * List work journals for a course.
 *
 * options:
 *   - forName: '@student' or '@team' (used by evaluation_journal page)
 *   - email: student's email (used by work_journal page "my past journals")
 */
async function getWorkJournals(courseId, options = {}) {
  if (!courseId) return [];

  const { forName, email } = options;
  const filters = ['wj.course_id = $1'];
  const params = [courseId];
  let idx = 2;

  if (email) {
    filters.push('LOWER(u.email) = LOWER($' + idx + ')');
    params.push(email.toLowerCase());
    idx += 1;
  }

  if (forName) {
    const trimmed = (forName || '').trim();
    const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    // simple substring match against user display_name, email, or team name
    filters.push(
      `(
        LOWER(u.display_name) LIKE LOWER($${idx})
        OR LOWER(u.email) LIKE LOWER($${idx})
        OR LOWER(t.name) LIKE LOWER($${idx})
      )`,
    );
    params.push(`%${withoutAt}%`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await db.query(
    `
    SELECT
      wj.*,
      u.display_name AS user_name,
      u.email        AS user_email,
      t.name         AS team_name
    FROM work_journals wj
    JOIN users u ON u.id = wj.user_id
    LEFT JOIN teams t ON t.id = wj.team_id
    ${whereClause}
    ORDER BY wj.created_at DESC
    LIMIT 200
    `,
    params,
  );

  return rows.map(mapJournalRow);
}

/**
 * Create a new work journal entry.
 *
 * payload can be from the /work_journal page:
 *   {
 *     tasksDone,
 *     sentiment,        // e.g. "😀 Great", "🙂 Good", ...
 *     sentimentNotes,
 *     reachOut,         // '', 'team_lead', 'ta', 'professor'
 *     reachOutMessage,
 *     visibility,       // 'public' | 'private'
 *     repoLink,
 *     email,            // (we'll use this to resolve user_id)
 *     userId            // (optional explicit id, overrides email)
 *   }
 */
async function createWorkJournal(courseId, payload = {}) {
  if (!courseId) {
    throw new Error('courseId is required to create a work journal entry');
  }

  const userId = await resolveUserId(courseId, payload);

  const {
    tasksDone = '',
    sentiment = '',
    sentimentNotes = '',
    reachOut = '',
    reachOutMessage = '',
    visibility = 'private',
    repoLink = '',
  } = payload;

  const trimmedTasks = (tasksDone || '').trim();
  if (!trimmedTasks) {
    throw new Error('tasksDone is required to create a work journal entry');
  }

  // Build content text we store in the DB
  let content = trimmedTasks;
  if (sentimentNotes) {
    content += `\n\nNotes:\n${sentimentNotes}`;
  }
  if (reachOutMessage) {
    content += `\n\nReach-out message:\n${reachOutMessage}`;
  }
  if (repoLink) {
    content += `\n\nRepo: ${repoLink}`;
  }

  // Map sentiment string to numeric scores
  const s = (sentiment || '').toLowerCase();
  let sentimentValue = 1; // neutral default
  if (s.includes('great') || s.includes('😀') || s.includes('good') || s.includes('🙂')) {
    sentimentValue = 2;
  } else if (s.includes('bad') || s.includes('terrible') || s.includes('😢') || s.includes('😭') || s.includes('😞')) {
    sentimentValue = 0;
  }

  // For now we mirror self/team/course sentiment
  const sentimentSelf = sentimentValue;
  const sentimentTeam = 1;
  const sentimentCourse = 1;

  // Map reachOut string to DB enum
  let reachOutTo = 'none';
  if (reachOut === 'professor') reachOutTo = 'professor';
  else if (reachOut === 'ta') reachOutTo = 'ta';
  else if (reachOut === 'team_lead') reachOutTo = 'team_leader';

  const moodText = sentimentNotes || sentiment || null;

  const { rows } = await db.query(
    `
    INSERT INTO work_journals (
      course_id,
      user_id,
      team_id,
      ta_user_id,
      content,
      sentiment_self,
      sentiment_team,
      sentiment_course,
      mood_text,
      reach_out_to,
      visibility
    )
    VALUES ($1,$2,NULL,NULL,$3,$4,$5,$6,$7,$8,$9)
    RETURNING
      id,
      course_id,
      user_id,
      team_id,
      ta_user_id,
      content,
      sentiment_self,
      sentiment_team,
      sentiment_course,
      mood_text,
      reach_out_to,
      visibility,
      created_at
    `,
    [
      courseId,
      userId,
      content,
      sentimentSelf,
      sentimentTeam,
      sentimentCourse,
      moodText,
      reachOutTo,
      visibility === 'public' ? 'public' : 'private',
    ],
  );

  return mapJournalRow(rows[0]);
}

/**
 * Update an existing work journal entry (by id, within a course).
 * We preserve user_id and course_id, and only allow updating the
 * content / sentiment / visibility-related fields.
 */
async function updateWorkJournal(courseId, id, payload = {}) {
  if (!courseId || !id) return null;

  const {
    content,
    sentiment_self,
    sentiment_team,
    sentiment_course,
    mood_text,
    reach_out_to,
    visibility,
  } = payload;

  const fields = [];
  const params = [];
  let idx = 1;

  function addField(sqlFragment, value) {
    fields.push(`${sqlFragment} = $${idx}`);
    params.push(value);
    idx += 1;
  }

  if (content != null) addField('content', content);
  if (sentiment_self != null) addField('sentiment_self', sentiment_self);
  if (sentiment_team != null) addField('sentiment_team', sentiment_team);
  if (sentiment_course != null) addField('sentiment_course', sentiment_course);
  if (mood_text != null) addField('mood_text', mood_text);
  if (reach_out_to != null) addField('reach_out_to', reach_out_to);
  if (visibility != null) addField('visibility', visibility);

  if (!fields.length) {
    return null;
  }

  params.push(courseId);
  params.push(id);

  const { rows } = await db.query(
    `
    UPDATE work_journals
    SET ${fields.join(', ')}
    WHERE course_id = $${idx} AND id = $${idx + 1}
    RETURNING
      id,
      course_id,
      user_id,
      team_id,
      ta_user_id,
      content,
      sentiment_self,
      sentiment_team,
      sentiment_course,
      mood_text,
      reach_out_to,
      visibility,
      created_at
    `,
    params,
  );

  if (!rows.length) return null;
  return mapJournalRow(rows[0]);
}

/**
 * Delete a work journal entry by id (scoped to course).
 */
async function deleteWorkJournal(courseId, id) {
  if (!courseId || !id) return false;

  const { rowCount } = await db.query(
    `
    DELETE FROM work_journals
    WHERE course_id = $1 AND id = $2
    `,
    [courseId, id],
  );

  return rowCount > 0;
}

module.exports = {
  getWorkJournals,
  createWorkJournal,
  updateWorkJournal,
  deleteWorkJournal,
};

// ------------------------------
// Read/unread tracking helpers
// ------------------------------

async function ensureReadsTable() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS work_journal_reads (
       id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       journal_id      uuid NOT NULL REFERENCES work_journals(id) ON DELETE CASCADE,
       viewer_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       read_at         timestamptz NOT NULL DEFAULT now(),
       CONSTRAINT work_journal_reads_unique UNIQUE (journal_id, viewer_user_id)
     )`
  );
}

async function getReadMapForViewer(viewerUserId, journalIds = []) {
  if (!viewerUserId || !Array.isArray(journalIds) || !journalIds.length) {
    return new Set();
  }
  await ensureReadsTable();
  const { rows } = await db.query(
    `SELECT journal_id FROM work_journal_reads
      WHERE viewer_user_id = $1 AND journal_id = ANY($2::uuid[])`,
    [viewerUserId, journalIds]
  );
  return new Set(rows.map(r => r.journal_id));
}

async function markJournalRead(journalId, viewerUserId) {
  if (!journalId || !viewerUserId) return false;
  await ensureReadsTable();
  await db.query(
    `INSERT INTO work_journal_reads (journal_id, viewer_user_id)
     VALUES ($1, $2)
     ON CONFLICT (journal_id, viewer_user_id) DO NOTHING`,
    [journalId, viewerUserId]
  );
  return true;
}

module.exports.ensureReadsTable = ensureReadsTable;
module.exports.getReadMapForViewer = getReadMapForViewer;
module.exports.markJournalRead = markJournalRead;
