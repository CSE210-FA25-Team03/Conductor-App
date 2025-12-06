// backend/db/studentWeekly.js
//
// Aggregates weekly evaluation data for a student:
// - evaluation_reports (per-week status/mood/notes)
// - public eval_notes (visibility = 'shared')
// - work_journals + journal_replies
//
// Accessed via email + course_id.

const db = require('./index');

/**
 * Resolve a user by email (case-insensitive).
 */
async function findUserByEmail(emailRaw) {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!email) return null;

  const { rows } = await db.query(
    `
    SELECT
      id,
      email,
      COALESCE(
        display_name,
        NULLIF(TRIM(given_name || ' ' || family_name), ''),
        email
      ) AS display_name
    FROM users
    WHERE LOWER(email) = $1
    LIMIT 1
    `,
    [email],
  );

  return rows[0] || null;
}

/**
 * Load evaluation_reports for this student in this course.
 */
async function getEvaluationReports(courseId, userId) {
  const { rows } = await db.query(
    `
    SELECT
      id,
      week_label,
      status,
      mood,
      notes,
      created_at,
      updated_at
    FROM evaluation_reports
    WHERE course_id = $1
      AND user_id   = $2
    ORDER BY created_at ASC
    `,
    [courseId, userId],
  );

  return rows.map((r) => ({
    id: r.id,
    weekLabel: r.week_label,
    status: r.status,
    mood: r.mood,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Load public eval_notes (visibility='shared') for this student.
 */
async function getPublicNotes(courseId, userId) {
  const { rows } = await db.query(
    `
    SELECT
      n.id,
      n.body,
      n.public_text,
      n.private_text,
      n.sentiment,
      n.independence_score,
      n.technical_score,
      n.teamwork_score,
      n.created_at,
      au.display_name AS author_name,
      au.email        AS author_email
    FROM eval_notes n
    JOIN users au ON au.id = n.author_id
    WHERE n.course_id    = $1
      AND n.subject_type = 'user'
      AND n.subject_id   = $2
      AND n.visibility   = 'shared'
    ORDER BY n.created_at ASC
    `,
    [courseId, userId],
  );

  return rows.map((r) => ({
    id: r.id,
    authorName: r.author_name || r.author_email,
    authorEmail: r.author_email,
    message: r.public_text || r.body,
    sentiment: r.sentiment,
    independenceScore: r.independence_score,
    technicalScore: r.technical_score,
    teamworkScore: r.teamwork_score,
    createdAt: r.created_at,
  }));
}

/**
 * Load recent work_journals for this student plus replies.
 */
async function getWorkJournalsWithReplies(courseId, userId, limit = 20) {
  // 1) Recent journals
  const { rows: journalRows } = await db.query(
    `
    SELECT
      j.id,
      j.content,
      j.sentiment_self,
      j.sentiment_team,
      j.sentiment_course,
      j.mood_text,
      j.reach_out_to,
      j.created_at
    FROM work_journals j
    WHERE j.course_id = $1
      AND j.user_id   = $2
    ORDER BY j.created_at DESC
    LIMIT $3
    `,
    [courseId, userId, limit],
  );

  if (!journalRows.length) {
    return [];
  }

  const journalIds = journalRows.map((j) => j.id);

  // 2) Replies for all those journals
  const { rows: replyRows } = await db.query(
    `
    SELECT
      r.id,
      r.journal_id,
      r.body,
      r.created_at,
      u.display_name AS author_name,
      u.email        AS author_email
    FROM journal_replies r
    JOIN users u ON u.id = r.author_id
    WHERE r.journal_id = ANY($1::uuid[])
    ORDER BY r.created_at ASC
    `,
    [journalIds],
  );

  const repliesByJournal = {};
  replyRows.forEach((r) => {
    if (!repliesByJournal[r.journal_id]) repliesByJournal[r.journal_id] = [];
    repliesByJournal[r.journal_id].push({
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      authorName: r.author_name || r.author_email,
      authorEmail: r.author_email,
    });
  });

  // 3) Combine
  return journalRows.map((j) => ({
    id: j.id,
    content: j.content,
    sentimentSelf: j.sentiment_self,
    sentimentTeam: j.sentiment_team,
    sentimentCourse: j.sentiment_course,
    moodText: j.mood_text,
    reachOutTo: j.reach_out_to,
    createdAt: j.created_at,
    replies: repliesByJournal[j.id] || [],
  }));
}

/**
 * Public API used by the route:
 *   getWeeklyEvaluation(courseId, email)
 */
async function getWeeklyEvaluation(courseId, emailRaw) {
  const user = await findUserByEmail(emailRaw);
  if (!user) {
    return null;
  }

  const reports = await getEvaluationReports(courseId, user.id);
  const notes = await getPublicNotes(courseId, user.id);
  const journals = await getWorkJournalsWithReplies(courseId, user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.display_name || user.email,
    },
    reports,
    notes,
    journals,
  };
}

module.exports = {
  getWeeklyEvaluation,
};
