// backend/db/tasks.js
//
// Implements the /api/tasks board using project_stories + project_tasks tables.
// IMPORTANT: We **never** write the string "TBD" or any free-form text into
// the timestamptz column `due_at`. We keep it NULL and derive the display
// string from the task status when reading.

const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

// Helper to ensure we have a course id
function requireCourseId() {
  const courseId = getCurrentCourseId && getCurrentCourseId();
  if (!courseId) {
    throw new Error('No current course ID configured for tasks board');
  }
  return courseId;
}

/**
 * Read the tasks board from project_stories + project_tasks as:
 *
 * {
 *   "Some Story": {
 *      todo:    [ { title, badge, due, assignee, githubIssueNumber, githubUrl, githubState? }, ... ],
 *      progress:[ ... ],
 *      done:    [ ... ]
 *   },
 *   ...
 * }
 */
async function getTasksBoard() {
  let courseId;
  try {
    courseId = requireCourseId();
  } catch {
    // If course not configured, just return empty object (frontend handles it)
    return {};
  }

  // 1) Load stories
  const { rows: storyRows } = await db.query(
    `
    SELECT id, title
    FROM project_stories
    WHERE course_id = $1
    ORDER BY position ASC, created_at ASC
    `,
    [courseId],
  );

  if (!storyRows.length) {
    return {};
  }

  const storyIdToName = {};
  const board = {};

  storyRows.forEach((row) => {
    storyIdToName[row.id] = row.title;
    board[row.title] = {
      todo: [],
      progress: [],
      done: [],
    };
  });

  // 2) Load tasks
  const { rows: taskRows } = await db.query(
    `
    SELECT
      id,
      story_id,
      title,
      status,
      badge,
      due_at,
      github_issue_number,
      github_url
    FROM project_tasks
    WHERE course_id = $1
    ORDER BY position ASC, created_at ASC
    `,
    [courseId],
  );

  taskRows.forEach((row) => {
    const storyName = storyIdToName[row.story_id];
    if (!storyName || !board[storyName]) return;

    const group = row.status; // 'todo' | 'progress' | 'done'
    if (!board[storyName][group]) {
      board[storyName][group] = [];
    }

    // Simple UI string – do NOT store this in DB as timestamptz
    const dueString = row.status === 'done' ? 'Completed' : 'TBD';

    board[storyName][group].push({
      title: row.title,
      badge: row.badge || 'medium',
      due: dueString,
      assignee: 'None',
      githubIssueNumber: row.github_issue_number || null,
      githubUrl: row.github_url || null,
      githubState: row.status === 'done' ? 'closed' : 'open',
    });
  });

  return board;
}

/**
 * Overwrite the entire tasks board for the current course.
 * We DELETE all stories & tasks for this course, then reinsert from `board`.
 *
 * CRITICAL:
 *   - `due_at` is always NULL (we never write "TBD" into a timestamptz field).
 */
async function overwriteTasksBoard(board) {
  let courseId;
  try {
    courseId = requireCourseId();
  } catch (err) {
    console.error('overwriteTasksBoard: no course configured:', err.message);
    return;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Clear existing tasks & stories
    await client.query(
      `DELETE FROM project_tasks WHERE course_id = $1`,
      [courseId],
    );
    await client.query(
      `DELETE FROM project_stories WHERE course_id = $1`,
      [courseId],
    );

    const storyNameToId = {};
    let storyPosition = 0;

    // 1) Insert stories
    const storyNames = Object.keys(board || {});
    for (const storyName of storyNames) {
      storyPosition += 1;
      const { rows } = await client.query(
        `
        INSERT INTO project_stories (course_id, title, description, position)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [courseId, storyName, null, storyPosition],
      );
      storyNameToId[storyName] = rows[0].id;
    }

    // 2) Insert tasks
    let taskPosition = 0;
    for (const storyName of storyNames) {
      const storyId = storyNameToId[storyName];
      if (!storyId) continue;

      const columns = board[storyName] || {};
      for (const group of ['todo', 'progress', 'done']) {
        const tasks = columns[group] || [];
        for (const task of tasks) {
          taskPosition += 1;

          const status =
            group === 'progress' ? 'progress' : group === 'done' ? 'done' : 'todo';

          const badge = task.badge || 'medium';
          const githubIssueNumber =
            typeof task.githubIssueNumber === 'number' ? task.githubIssueNumber : null;
          const githubUrl = task.githubUrl || null;

          // NOTE: due_at is always NULL here to avoid the "TBD" timestamptz error
          await client.query(
            `
            INSERT INTO project_tasks (
              course_id,
              story_id,
              title,
              description,
              status,
              badge,
              due_at,
              assignee_id,
              position,
              github_issue_number,
              github_url
            )
            VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL,$7,$8,$9)
            `,
            [
              courseId,
              storyId,
              task.title || 'Untitled Task',
              null,
              status,
              badge,
              taskPosition,
              githubIssueNumber,
              githubUrl,
            ],
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error overwriting tasks board:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getTasksBoard,
  overwriteTasksBoard,
};
