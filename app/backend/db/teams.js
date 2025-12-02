// backend/db/teams.js
const db = require('./index');

async function getAllTeams(courseId) {
  const { rows } = await db.query(
    `
        SELECT id,
          code AS "teamNumber",
          name,
          status,
          description,
          status_description AS "statusDescription",
          repo_url AS "repoUrl",
          display_number AS "displayNumber",
          next_sync_at AS "nextSync"
    FROM teams
    WHERE course_id = $1
    ORDER BY created_at ASC
    `,
    [courseId],
  );
  return rows;
}

async function getTeamById(id, courseId) {
  const { rows } = await db.query(
    `
        SELECT id,
          code AS "teamNumber",
          name,
          status,
          description,
          status_description AS "statusDescription",
          repo_url AS "repoUrl",
          display_number AS "displayNumber",
          next_sync_at AS "nextSync"
    FROM teams
    WHERE id = $1 AND course_id = $2
    `,
    [id, courseId],
  );
  return rows[0] || null;
}

async function createTeam(courseId, teamData) {
  const {
    teamNumber,
    name,
    status = 'Needs Review',
    description = '',
    statusDescription = '',
    displayNumber = null,
    nextSync = null,
  } = teamData;

  const { rows } = await db.query(
    `
    INSERT INTO teams (course_id, code, name, status, description, status_description, repo_url, display_number, next_sync_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id,
              code AS "teamNumber",
              name,
              status,
              description,
              status_description AS "statusDescription",
              repo_url AS "repoUrl",
              display_number AS "displayNumber",
              next_sync_at AS "nextSync"
    `,
    [courseId, teamNumber, name, status, description, statusDescription, teamData.repoUrl || null, displayNumber, nextSync],
  );
  return rows[0];
}

async function updateTeam(id, courseId, updates) {
  const existing = await getTeamById(id, courseId);
  if (!existing) return null;

  const merged = {
    ...existing,
    ...updates,
    id, // never change ID
  };

  const {
    teamNumber,
    name,
    status,
    description,
    statusDescription,
    displayNumber,
    nextSync,
  } = merged;

  const { rows } = await db.query(
    `
    UPDATE teams
    SET code = $3,
        name = $4,
        status = $5,
        description = $6,
        status_description = $7,
        repo_url = $8,
        display_number = $9,
        next_sync_at = $10
    WHERE id = $1 AND course_id = $2
    RETURNING id,
              code AS "teamNumber",
              name,
              status,
              description,
              status_description AS "statusDescription",
              repo_url AS "repoUrl",
              display_number AS "displayNumber",
              next_sync_at AS "nextSync"
    `,
    [id, courseId, teamNumber, name, status, description, statusDescription, merged.repoUrl || null, displayNumber, nextSync],
  );
  return rows[0] || null;
}

async function deleteTeam(id, courseId) {
  const { rowCount } = await db.query(
    `DELETE FROM teams WHERE id = $1 AND course_id = $2`,
    [id, courseId],
  );
  return rowCount > 0;
}

module.exports = {
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
};
