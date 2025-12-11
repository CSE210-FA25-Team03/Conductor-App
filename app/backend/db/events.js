// backend/db/events.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getEvents(courseIdOverride) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return [];

  const { rows } = await db.query(
    `
    SELECT id,
           title,
           description,
           type,
           starts_at AS "startsAt",
           due_at AS "dueDate"
    FROM class_events
    WHERE course_id = $1
    ORDER BY COALESCE(due_at, starts_at) ASC, created_at ASC
    `,
    [courseId],
  );

  return rows;
}

async function createEvent(courseIdOverride, payload) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) {
    throw new Error('courseId is required to create an event');
  }

  const {
    title,
    description,
    type,
    startsAt,
    dueDate,
  } = payload || {};

  const { rows } = await db.query(
    `
    INSERT INTO class_events (
      course_id,
      title,
      description,
      type,
      starts_at,
      due_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id,
              title,
              description,
              type,
              starts_at AS "startsAt",
              due_at AS "dueDate"
    `,
    [courseId, title, description, type, startsAt, dueDate],
  );

  return rows[0];
}


async function updateEvent(courseIdOverride, id, payload) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return null;

  // Fetch existing event to merge with incoming payload
  const existingRes = await db.query(
    `
    SELECT id,
           title,
           description,
           type,
           starts_at AS "startsAt",
           due_at AS "dueDate"
    FROM class_events
    WHERE id = $1 AND course_id = $2
    `,
    [id, courseId],
  );
  const existing = existingRes.rows[0];
  if (!existing) return null;

  const updates = payload || {};
  const merged = {
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    type: updates.type ?? existing.type,
    startsAt: updates.startsAt ?? existing.startsAt,
    dueDate: updates.dueDate ?? existing.dueDate,
  };

  const { rows } = await db.query(
    `
    UPDATE class_events
    SET title = $3,
        description = $4,
        type = $5,
        starts_at = $6,
        due_at = $7,
        updated_at = now()
    WHERE id = $1 AND course_id = $2
    RETURNING id,
              title,
              description,
              type,
              starts_at AS "startsAt",
              due_at AS "dueDate"
    `,
    [id, courseId, merged.title, merged.description, merged.type, merged.startsAt, merged.dueDate],
  );
  return rows[0] || null;
}

async function deleteEvent(courseIdOverride, id) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return false;

  const { rowCount } = await db.query(
    `DELETE FROM class_events WHERE id = $1 AND course_id = $2`,
    [id, courseId],
  );
  return rowCount > 0;
}


module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};
