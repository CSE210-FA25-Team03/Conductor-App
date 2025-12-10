// app/backend/db/tickets.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function create(courseIdOverride, userId, { title, body, assigneeTutorId, assigneeTutorEmail }) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) throw new Error('courseId is required');
  if (!userId) throw new Error('userId is required');
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t || !b) throw new Error('title and body are required');

  // Resolve assignee tutor id if only email was provided
  let assigneeId = assigneeTutorId || null;
  if (!assigneeId && assigneeTutorEmail) {
    const { rows: urows } = await db.query(`SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`, [assigneeTutorEmail]);
    if (urows.length) assigneeId = urows[0].id;
  }
  const { rows } = await db.query(
    `INSERT INTO support_tickets (course_id, created_by, assignee_tutor_id, title, body, status)
     VALUES ($1, $2, $3, $4, $5, 'open')
     RETURNING id, title, body, status, created_at AS "createdAt"`,
    [courseId, userId, assigneeId, t, b]
  );
  return rows[0];
}

async function listByCourse(courseIdOverride, viewer) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return [];
  const isTutor = viewer && (viewer.role === 'tutor');
  let query = `SELECT st.id, st.title, st.body, st.status, st.created_at AS "createdAt",
                      u.display_name AS "createdByName", u.email AS "createdByEmail"
                 FROM support_tickets st
                 JOIN users u ON u.id = st.created_by
                WHERE st.course_id = $1`;
  const params = [courseId];
  if (isTutor) {
    query += ` AND st.assignee_tutor_id = $2`;
    params.push(viewer.id);
  }
  query += ` ORDER BY st.created_at ASC`;
  const { rows } = await db.query(query, params);
  return rows;
}

module.exports = {
  create,
  listByCourse,
  async listMine(courseIdOverride, userId) {
    const courseId = courseIdOverride || getCurrentCourseId();
    if (!courseId || !userId) return [];
    const { rows } = await db.query(
      `SELECT st.id,
              st.title,
              st.body,
              st.status,
              st.created_at AS "createdAt",
              u.display_name AS "createdByName",
              u.email AS "createdByEmail",
              EXISTS (
                SELECT 1 FROM support_ticket_replies r WHERE r.ticket_id = st.id
              ) AS responded,
              COALESCE((SELECT COUNT(1) FROM support_ticket_replies r2 WHERE r2.ticket_id = st.id), 0) AS "replyCount",
              (SELECT MAX(r3.created_at) FROM support_ticket_replies r3 WHERE r3.ticket_id = st.id) AS "lastReplyAt"
         FROM support_tickets st
         JOIN users u ON u.id = st.created_by
        WHERE st.course_id = $1 AND st.created_by = $2 AND st.status = 'open'
        ORDER BY st.created_at DESC`,
      [courseId, userId]
    );
    return rows;
  },
  async remove(courseIdOverride, userId, ticketId) {
    const courseId = courseIdOverride || getCurrentCourseId();
    if (!courseId || !userId || !ticketId) return false;
    const { rowCount } = await db.query(
      `UPDATE support_tickets SET status = 'closed'
       WHERE id = $1 AND course_id = $2 AND created_by = $3`,
      [ticketId, courseId, userId]
    );
    return rowCount > 0;
  },
  async listReplies(courseIdOverride, userId, ticketId) {
    const courseId = courseIdOverride || getCurrentCourseId();
    if (!courseId || !userId || !ticketId) return [];
    const { rows } = await db.query(
      `SELECT r.id, r.ticket_id, r.author_id, r.body, r.created_at AS "createdAt",
              u.display_name AS author_name
         FROM support_ticket_replies r
         JOIN support_tickets t ON t.id = r.ticket_id
         LEFT JOIN users u ON u.id = r.author_id
        WHERE r.ticket_id = $1 AND t.course_id = $2
        ORDER BY r.created_at ASC`,
      [ticketId, courseId]
    );
    return rows;
  },
  async addReply(courseIdOverride, userId, ticketId, body) {
    const courseId = courseIdOverride || getCurrentCourseId();
    if (!courseId || !userId || !ticketId) throw new Error('invalid arguments');
    const b = String(body || '').trim();
    if (!b) throw new Error('body required');
    const { rows: trows } = await db.query(
      `SELECT id FROM support_tickets WHERE id = $1 AND course_id = $2`,
      [ticketId, courseId]
    );
    if (!trows.length) throw new Error('Ticket not found');
    const { rows } = await db.query(
      `INSERT INTO support_ticket_replies (ticket_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, ticket_id, author_id, body, created_at AS "createdAt"`,
      [ticketId, userId, b]
    );
    return rows[0];
  },
};
