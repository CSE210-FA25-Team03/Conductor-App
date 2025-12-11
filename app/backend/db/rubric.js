// backend/db/rubric.js

/* DB helpers for course rubric items, stored in `course_rubric_items`.

Actual table structure (from schema.sql):
   course_rubric_items (
     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
     item_key   text NOT NULL,  -- 'attendance', 'work_journal', etc.
     label      text NOT NULL,
     enabled    boolean NOT NULL DEFAULT false,
     weight     numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
     updated_at timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT course_rubric_items_course_item_unique UNIQUE (course_id, item_key)
   );

 This module exposes a simple JSON shape compatible with the server:
   {
     id,
     courseId,
     itemKey,
     label,
     enabled,
     weight
   }
*/

const db = require('./index');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_id,
    itemKey: row.item_key,
    label: row.label,
    enabled: row.enabled,
    // Ensure weight is a JS number (not a string) and non-negative
    weight: row.weight != null ? Number(row.weight) : 0,
  };
}

/**
 * Get all rubric items for a course.
 */
async function getCourseRubric(courseId) {
  if (!courseId) {
    throw new Error('Course ID is required to fetch rubric');
  }

  const { rows } = await db.query(
    `
    SELECT
      id,
      course_id,
      item_key,
      label,
      enabled,
      weight,
      updated_at
    FROM course_rubric_items
    WHERE course_id = $1
    ORDER BY item_key ASC, updated_at DESC
    `,
    [courseId],
  );

  return rows.map(mapRow);
}

/**
 * Create a new rubric item.
 *
 * data: {
 *   itemKey: string,     // required, e.g. 'attendance'
 *   label: string,       // required, display label
 *   enabled?: boolean,
 *   weight?: number
 * }
 */
async function createRubricItem(courseId, data = {}) {
  if (!courseId) {
    throw new Error('Course ID is required to create a rubric item');
  }

  const {
    itemKey,
    label,
    enabled = false,
    weight = 0,
  } = data;

  if (!itemKey || !String(itemKey).trim()) {
    throw new Error('itemKey is required to create a rubric item');
  }
  if (!label || !String(label).trim()) {
    throw new Error('label is required to create a rubric item');
  }

  const numericWeight = Number(weight) || 0;
  if (numericWeight < 0) {
    throw new Error('weight must be >= 0');
  }

  const { rows } = await db.query(
    `
    INSERT INTO course_rubric_items (
      course_id,
      item_key,
      label,
      enabled,
      weight
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      course_id,
      item_key,
      label,
      enabled,
      weight,
      updated_at
    `,
    [courseId, itemKey.trim(), label.trim(), !!enabled, numericWeight],
  );

  return mapRow(rows[0]);
}

/**
 * Update an existing rubric item.
 *
 * data: same shape as createRubricItem
 */
async function updateRubricItem(courseId, id, data = {}) {
  if (!courseId) {
    throw new Error('Course ID is required to update a rubric item');
  }
  if (!id) {
    throw new Error('id is required to update a rubric item');
  }

  const {
    itemKey,
    label,
    enabled = false,
    weight = 0,
  } = data;

  if (!itemKey || !String(itemKey).trim()) {
    throw new Error('itemKey is required to update a rubric item');
  }
  if (!label || !String(label).trim()) {
    throw new Error('label is required to update a rubric item');
  }

  const numericWeight = Number(weight) || 0;
  if (numericWeight < 0) {
    throw new Error('weight must be >= 0');
  }

  const { rows } = await db.query(
    `
    UPDATE course_rubric_items
    SET
      item_key  = $3,
      label     = $4,
      enabled   = $5,
      weight    = $6,
      updated_at = now()
    WHERE id = $1
      AND course_id = $2
    RETURNING
      id,
      course_id,
      item_key,
      label,
      enabled,
      weight,
      updated_at
    `,
    [id, courseId, itemKey.trim(), label.trim(), !!enabled, numericWeight],
  );

  if (!rows.length) {
    return null;
  }

  return mapRow(rows[0]);
}

/**
 * Delete a rubric item.
 */
async function deleteRubricItem(courseId, id) {
  if (!courseId) {
    throw new Error('Course ID is required to delete a rubric item');
  }
  if (!id) {
    throw new Error('id is required to delete a rubric item');
  }

  const { rowCount } = await db.query(
    `
    DELETE FROM course_rubric_items
    WHERE id = $1
      AND course_id = $2
    `,
    [id, courseId],
  );

  return rowCount > 0;
}

module.exports = {
  getCourseRubric,
  createRubricItem,
  updateRubricItem,
  deleteRubricItem,
};
