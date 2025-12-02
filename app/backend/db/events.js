// backend/db/events.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getEvents() {
  const courseId = getCurrentCourseId();
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
    ORDER BY due_at NULLS LAST, created_at DESC
    `,
    [courseId],
  );
  return rows;
}

async function createEvent(eventData) {
  const courseId = getCurrentCourseId();
  const {
    title,
    description = '',
    type,
    startsAt = null,
    dueDate = null,
  } = eventData;

  const { rows } = await db.query(
    `
    INSERT INTO class_events (course_id, title, description, type, starts_at, due_at)
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

async function updateEvent(id, updates) {
  const courseId = getCurrentCourseId();
  const currentEvents = await getEvents();
  const existing = currentEvents.find(e => e.id === id);
  if (!existing) return null;

  const merged = { ...existing, ...updates };

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

async function deleteEvent(id) {
  const courseId = getCurrentCourseId();
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
