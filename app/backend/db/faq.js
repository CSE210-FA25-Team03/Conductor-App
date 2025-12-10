// app/backend/db/faq.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function listByCourse(courseIdOverride) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return [];
  const { rows } = await db.query(
    `SELECT id, question, answer
     FROM faq
     WHERE course_id = $1
     ORDER BY created_at ASC`,
    [courseId]
  );
  return rows;
}

async function create(courseIdOverride, { question, answer }) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) throw new Error('courseId is required');
  const q = (question || '').trim();
  const a = (answer || '').trim();
  if (!q || !a) throw new Error('question and answer are required');

  const { rows } = await db.query(
    `INSERT INTO faq (course_id, question, answer)
     VALUES ($1, $2, $3)
     RETURNING id, question, answer`,
    [courseId, q, a]
  );
  return rows[0];
}

async function update(id, courseIdOverride, { question, answer }) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) throw new Error('courseId is required');

  // Fetch existing to allow partial updates if needed in future
  const { rows: existingRows } = await db.query(
    `SELECT id, question, answer FROM faq WHERE id = $1 AND course_id = $2`,
    [id, courseId]
  );
  if (!existingRows.length) return null;

  const current = existingRows[0];
  const q = question != null ? String(question).trim() : current.question;
  const a = answer != null ? String(answer).trim() : current.answer;

  const { rows } = await db.query(
    `UPDATE faq
       SET question = $3,
           answer = $4,
           updated_at = now()
     WHERE id = $1 AND course_id = $2
     RETURNING id, question, answer`,
    [id, courseId, q, a]
  );
  return rows[0] || null;
}

async function remove(id, courseIdOverride) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) throw new Error('courseId is required');
  const { rowCount } = await db.query(
    `DELETE FROM faq WHERE id = $1 AND course_id = $2`,
    [id, courseId]
  );
  return rowCount > 0;
}

module.exports = {
  listByCourse,
  create,
  update,
  remove,
};
