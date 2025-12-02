// backend/db/studentWeeklyEval.js

const db = require('./index');

/**
 * Look up a user by email.
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
        NULLIF(display_name, ''),
        NULLIF(given_name || ' ' || family_name, ' '),
        email
      ) AS name
    FROM users
    WHERE LOWER(email) = $1
    LIMIT 1
    `,
    [email],
  );

  if (!rows.length) return null;
  return rows[0];
}

/**
 * Find the student's primary team (if any) in this course.
 */
async function findStudentTeam(courseId, userId) {
  const { rows } = await db.query(
    `
    SELECT
      t.id,
      t.name,
      t.code
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE t.course_id = $1
      AND tm.user_id = $2
    ORDER BY t.created_at ASC
    LIMIT 1
    `,
    [courseId, userId],
  );

  if (!rows.length) return null;
  return rows[0];
}

/**
 * Get evaluation reports (if you ever use evaluation_reports).
 */
async function getEvalReports(courseId, userId) {
  const { rows } = await db.query(
    `
    SELECT
      week_label,
      status,
      mood,
      notes,
      created_at
    FROM evaluation_reports
    WHERE course_id = $1
      AND user_id = $2
    ORDER BY created_at ASC
    `,
    [courseId, userId],
  );

  return rows.map((r) => ({
    weekLabel: r.week_label,
    status: r.status,
    mood: r.mood,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

/**
 * Get all public eval_notes about this student (user-scoped and team-scoped).
 */
async function getPublicNotes(courseId, userId, teamIdOrNull) {
  const params = [courseId, userId];
  let teamClause = '';
  if (teamIdOrNull) {
    params.push(teamIdOrNull);
    teamClause = `
      OR (subject_type = 'team' AND subject_id = $3)
    `;
  }

  const { rows } = await db.query(
    `
    SELECT
      n.id,
      n.created_at,
      n.body,
      n.public_text,
      n.type,
      n.sentiment,
      n.independence_score,
      n.technical_score,
      n.teamwork_score,
      u.display_name,
      u.email AS author_email
    FROM eval_notes n
    JOIN users u ON u.id = n.author_id
    WHERE n.course_id = $1
      AND n.visibility = 'shared'
      AND (
        (n.subject_type = 'user' AND n.subject_id = $2)
        ${teamClause}
      )
    ORDER BY n.created_at DESC
    `,
    params,
  );

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    authorName: r.display_name || r.author_email,
    authorEmail: r.author_email,
    text: r.public_text || r.body,
    type: r.type,
    sentiment: r.sentiment,
    independenceScore: r.independence_score,
    technicalScore: r.technical_score,
    teamworkScore: r.teamwork_score,
  }));
}

/**
 * Get this student's work journals + any replies.
 * Only journals that have at least 1 reply are returned.
 */
async function getJournalsWithReplies(courseId, userId) {
  // 1) Get all journals for this user
  const { rows: journalRows } = await db.query(
    `
    SELECT
      j.id,
      j.created_at,
      j.content,
      j.mood_text,
      j.sentiment_self,
      j.sentiment_team,
      j.sentiment_course
    FROM work_journals j
    WHERE j.course_id = $1
      AND j.user_id = $2
    ORDER BY j.created_at DESC
    `,
    [courseId, userId],
  );

  if (!journalRows.length) return [];

  const journalIds = journalRows.map((j) => j.id);

  // 2) Replies for those journals
  const { rows: replyRows } = await db.query(
    `
    SELECT
      r.id,
      r.journal_id,
      r.body,
      r.created_at,
      u.display_name,
      u.email AS author_email
    FROM journal_replies r
    JOIN users u ON u.id = r.author_id
    WHERE r.journal_id = ANY($1::uuid[])
    ORDER BY r.created_at ASC
    `,
    [journalIds],
  );

  const repliesByJournal = new Map();
  replyRows.forEach((r) => {
    if (!repliesByJournal.has(r.journal_id)) {
      repliesByJournal.set(r.journal_id, []);
    }
    repliesByJournal.get(r.journal_id).push({
      id: r.id,
      createdAt: r.created_at,
      body: r.body,
      authorName: r.display_name || r.author_email,
      authorEmail: r.author_email,
    });
  });

  // 3) Only return journals that actually have replies
  return journalRows
    .filter((j) => repliesByJournal.has(j.id))
    .map((j) => ({
      id: j.id,
      createdAt: j.created_at,
      content: j.content,
      moodText: j.mood_text,
      sentimentSelf: j.sentiment_self,
      sentimentTeam: j.sentiment_team,
      sentimentCourse: j.sentiment_course,
      replies: repliesByJournal.get(j.id) || [],
    }));
}

/**
 * Aggregate everything for the student weekly evaluation view.
 */
async function getWeeklyEvaluationForStudent(courseId, emailRaw) {
  const user = await findUserByEmail(emailRaw);
  if (!user) {
    return {
      member: {
        id: null,
        name: 'Unknown student',
        email: (emailRaw || '').trim().toLowerCase(),
        teamName: null,
      },
      weeksLogged: 0,
      evalReports: [],
      publicNotes: [],
      journalsWithReplies: [],
    };
  }

  const team = await findStudentTeam(courseId, user.id);
  const teamId = team ? team.id : null;

  const [evalReports, publicNotes, journalsWithReplies] = await Promise.all([
    getEvalReports(courseId, user.id),
    getPublicNotes(courseId, user.id, teamId),
    getJournalsWithReplies(courseId, user.id),
  ]);

  return {
    member: {
      id: user.id,
      name: user.name,
      email: user.email,
      teamName: team ? team.name || team.code : null,
    },
    weeksLogged: evalReports.length,
    evalReports,
    publicNotes,
    journalsWithReplies,
  };
}

module.exports = {
  getWeeklyEvaluationForStudent,
};
