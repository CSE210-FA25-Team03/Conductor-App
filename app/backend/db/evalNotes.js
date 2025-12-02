// backend/db/evalNotes.js

const db = require('./index');

/* --------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */

function mapNoteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    visibility: row.visibility,
    sentiment: row.sentiment,
    type: row.type,
    body: row.body,
    privateText: row.private_text,
    publicText: row.public_text,
    independenceScore: row.independence_score,
    technicalScore: row.technical_score,
    teamworkScore: row.teamwork_score,
    week: row.week != null ? row.week : null,
    isRead: row.is_read,
    createdAt: row.created_at,
    authorId: row.author_id,
    authorName: row.author_name || null,
    authorEmail: row.author_email || null,
    authorRole: row.author_role || null,
  };
}
function extractWeekFromTexts(privateText, publicText) {
  const text = [publicText, privateText].find(Boolean) || '';
  const m = text.match(/\bWeek\s*(\d{1,2})\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseScore(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Simple heuristic sentiment from total rubric score (0–15).
 * Returns smallint or null.
 */
function computeSentimentFromScores(total) {
  if (total == null) return null;
  if (total >= 11) return 2; // good
  if (total >= 6) return 1;  // medium
  return 0;                  // low
}

/**
 * Ensure a user exists for the given email. Returns { id, email, display_name }.
 */
async function ensureUserByEmail(emailRaw) {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!email) {
    throw new Error('email is required to create eval note');
  }

  const { rows: existing } = await db.query(
    `
      SELECT id, email, display_name
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
    `,
    [email],
  );

  if (existing.length) {
    return existing[0];
  }

  const displayName = email.split('@')[0] || 'User';
  const { rows } = await db.query(
    `
      INSERT INTO users (email, display_name, given_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, display_name
    `,
    [email, displayName, displayName],
  );

  return rows[0];
}

/* --------------------------------------------------------------------------
   Existing per-member API (by subject user id)
--------------------------------------------------------------------------- */

async function getNotesForMember(courseId, memberId) {
  if (!courseId || !memberId) return [];

  const { rows } = await db.query(
    `
      SELECT
        n.*,
        u.display_name AS author_name,
        u.email        AS author_email,
        (
          SELECT r.label
          FROM role_assignments ra
          JOIN roles r ON r.id = ra.role_id
          WHERE ra.user_id = n.author_id
            AND ra.scope_type = 'course'
            AND ra.scope_id = $1
          LIMIT 1
        ) AS author_role
      FROM eval_notes n
      JOIN users u ON u.id = n.author_id
      WHERE n.course_id    = $1
        AND n.subject_type = 'user'
        AND n.subject_id   = $2
      ORDER BY n.created_at DESC
    `,
    [courseId, memberId],
  );

  return rows.map(mapNoteRow);
}

/**
 * Create note for a member by id. (Used by /api/evaluations/:memberId/notes)
 * data may contain: { privateText, publicText, type, visibility, scores, sentiment, authorEmail }
 */
async function createNoteForMember(courseId, memberId, data = {}) {
  if (!courseId) {
    throw new Error('courseId is required to create eval note');
  }
  if (!memberId) {
    throw new Error('memberId is required to create eval note');
  }

  let authorId = data.authorId || null;

  if (!authorId) {
    if (!data.authorEmail) {
      throw new Error('authorEmail is required when authorId is not provided');
    }
    const author = await ensureUserByEmail(data.authorEmail);
    authorId = author.id;
  }

  const visibility = data.visibility === 'shared' ? 'shared' : 'private';
  const type = data.type === 'rubric' ? 'rubric' : 'default';

  const privateText = (data.privateText || '').trim() || null;
  const publicText = (data.publicText || '').trim() || null;
  const body = (publicText || privateText || '').trim() || '(no text)';

  const scores = data.scores || {};
  const independenceScore = parseScore(scores.independence);
  const technicalScore = parseScore(scores.technical);
  const teamworkScore = parseScore(scores.teamwork);

  const total =
    (independenceScore || 0) +
    (technicalScore || 0) +
    (teamworkScore || 0);
  const sentiment =
    data.sentiment != null
      ? data.sentiment
      : computeSentimentFromScores(total);
  const weekNum = (() => {
    const n = parseInt(data.week, 10);
    return Number.isFinite(n) ? n : null;
  })();

  const { rows: inserted } = await db.query(
    `
      INSERT INTO eval_notes (
        course_id,
        author_id,
        subject_type,
        subject_id,
        visibility,
        sentiment,
        body,
        type,
        private_text,
        public_text,
        independence_score,
        technical_score,
        teamwork_score,
        week
      )
      VALUES ($1,$2,'user',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `,
    [
      courseId,
      authorId,
      memberId,
      visibility,
      sentiment,
      body,
      type,
      privateText,
      publicText,
      independenceScore,
      technicalScore,
      teamworkScore,
      weekNum,
    ],
  );

  const insertedId = inserted[0].id;

  const { rows } = await db.query(
    `
      SELECT
        n.*,
        u.display_name AS author_name,
        u.email        AS author_email,
        (
          SELECT r.label
          FROM role_assignments ra
          JOIN roles r ON r.id = ra.role_id
          WHERE ra.user_id = n.author_id
            AND ra.scope_type = 'course'
            AND ra.scope_id = $1
          LIMIT 1
        ) AS author_role
      FROM eval_notes n
      JOIN users u ON u.id = n.author_id
      WHERE n.id = $1
      LIMIT 1
    `,
    [courseId, insertedId],
  );

  const mapped = mapNoteRow(rows[0]);
  if (mapped.week == null) {
    mapped.week = extractWeekFromTexts(mapped.privateText, mapped.publicText);
  }
  return mapped;
}

/* --------------------------------------------------------------------------
   New API: by student email (used by Evaluation Journal page)
--------------------------------------------------------------------------- */

/**
 * Get notes for a user identified by email.
 */
async function getNotesForUserEmail(courseId, emailRaw) {
  if (!courseId) return [];
  const email = (emailRaw || '').trim().toLowerCase();
  if (!email) return [];

  // Find subject user
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
    return [];
  }

  const subjectId = userRows[0].id;

  const rows = await getNotesForMember(courseId, subjectId);
  return rows.map((n) => {
    const week = n.week != null ? n.week : extractWeekFromTexts(n.privateText, n.publicText);
    const scores = {
      independence: n.independenceScore,
      technical: n.technicalScore,
      teamwork: n.teamworkScore,
      total: (n.independenceScore || 0) + (n.technicalScore || 0) + (n.teamworkScore || 0),
    };
    return { ...n, week, scores };
  });
}

/**
 * Create a note for a student identified by email.
 * params: {
 *   targetEmail,
 *   authorEmail,
 *   privateText,
 *   publicText,
 *   mode,
 *   scores
 * }
 */
async function createNoteForUserEmail(courseId, params = {}) {
  if (!courseId) {
    throw new Error('courseId is required');
  }

  const targetEmail = (params.targetEmail || '').trim().toLowerCase();
  const authorEmail = (params.authorEmail || params.email || '').trim().toLowerCase();

  if (!targetEmail) {
    throw new Error('targetEmail is required to create eval note');
  }
  if (!authorEmail) {
    throw new Error('authorEmail is required to create eval note');
  }

  const subjectUser = await ensureUserByEmail(targetEmail);
  const authorUser = await ensureUserByEmail(authorEmail);

  const visibility = 'private'; // you can extend this later if needed
  const type = params.mode === 'rubric' ? 'rubric' : 'default';

  const privateText = (params.privateText || '').trim() || null;
  const publicText = (params.publicText || '').trim() || null;
  const weekNum = (() => {
    const n = parseInt(params.week, 10);
    return Number.isFinite(n) ? n : null;
  })();
  const body = (publicText || privateText || '').trim() || '(no text)';

  const scores = params.scores || {};
  const independenceScore = parseScore(scores.independence);
  const technicalScore = parseScore(scores.technical);
  const teamworkScore = parseScore(scores.teamwork);

  const total =
    (independenceScore || 0) +
    (technicalScore || 0) +
    (teamworkScore || 0);

  const sentiment = computeSentimentFromScores(total);

  const { rows: inserted } = await db.query(
    `
      INSERT INTO eval_notes (
        course_id,
        author_id,
        subject_type,
        subject_id,
        visibility,
        sentiment,
        body,
        type,
        private_text,
        public_text,
        independence_score,
        technical_score,
        teamwork_score,
        week
      )
      VALUES ($1,$2,'user',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `,
    [
      courseId,
      authorUser.id,
      subjectUser.id,
      visibility,
      sentiment,
      body,
      type,
      privateText,
      publicText,
      independenceScore,
      technicalScore,
      teamworkScore,
      weekNum,
    ],
  );

  const noteId = inserted[0].id;

  const { rows } = await db.query(
    `
      SELECT
        n.*,
        u.display_name AS author_name,
        u.email        AS author_email,
        (
          SELECT r.label
          FROM role_assignments ra
          JOIN roles r ON r.id = ra.role_id
          WHERE ra.user_id = n.author_id
            AND ra.scope_type = 'course'
            AND ra.scope_id = $2
          LIMIT 1
        ) AS author_role
      FROM eval_notes n
      JOIN users u ON u.id = n.author_id
      WHERE n.id = $1
      LIMIT 1
    `,
    [noteId, courseId],
  );

  const mapped = mapNoteRow(rows[0]);
  mapped.week = mapped.week != null ? mapped.week : (weekNum != null ? weekNum : extractWeekFromTexts(mapped.privateText, mapped.publicText));
  // Also provide a nested scores object to simplify frontend consumption
  mapped.scores = {
    independence: mapped.independenceScore,
    technical: mapped.technicalScore,
    teamwork: mapped.teamworkScore,
    total: (mapped.independenceScore || 0) + (mapped.technicalScore || 0) + (mapped.teamworkScore || 0),
  };
  return mapped;
}

module.exports = {
  getNotesForMember,
  createNoteForMember,
  getNotesForUserEmail,
  createNoteForUserEmail,
};
