// backend/db/teamCard.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getTeamCard(teamId, courseIdOverride = null) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId || !teamId) return null;

  // Base team info
  const { rows: teamRows } = await db.query(
    `SELECT t.id,
            t.code,
            t.name,
            t.display_number,
            t.status,
            t.description,
            t.status_description,
            t.repo_url
     FROM teams t
     WHERE t.id = $1 AND t.course_id = $2
     LIMIT 1`,
    [teamId, courseId]
  );
  if (!teamRows.length) return null;
  const team = teamRows[0];

  // TA assignment
  const { rows: taRows } = await db.query(
    `SELECT u.id, u.display_name, u.email
     FROM team_ta_assignments taa
     JOIN users u ON u.id = taa.ta_user_id
     WHERE taa.team_id = $1
     LIMIT 1`,
    [teamId]
  );
  const ta = taRows[0] || null;

  // Members
  const { rows: memberRows } = await db.query(
    `SELECT tm.user_id AS id,
            u.display_name AS name,
            u.email,
            tm.is_leader
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY u.display_name`,
    [teamId]
  );

  return {
    id: team.id,
    code: team.code,
    name: team.name,
    displayNumber: team.display_number,
    status: team.status,
    description: team.description || '',
    statusDescription: team.status_description || '',
    repoUrl: team.repo_url || '',
    ta: ta ? { id: ta.id, name: ta.display_name, email: ta.email } : null,
    members: memberRows.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      isLeader: m.is_leader,
    }))
  };
}




async function getTeamsForUser({ userId, email, courseId }) {
  // Pick courseId from argument, falling back to global default
  const effectiveCourseId = courseId || getCurrentCourseId();
  if (!effectiveCourseId) {
    return [];
  }

  // Resolve userId from email if needed
  let userIdToUse = userId;
  if (!userIdToUse && email) {
    const { rows: userRows } = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email.trim().toLowerCase()],
    );
    if (!userRows.length) {
      return [];
    }
    userIdToUse = userRows[0].id;
  }

  if (!userIdToUse) {
    return [];
  }

  const { rows } = await db.query(
    `
      SELECT
        t.id,
        t.code,
        t.name,
        t.display_number,
        t.status,
        t.description,
        t.repo_url,
        EXISTS (
          SELECT 1
          FROM team_members tm2
          WHERE tm2.team_id = t.id
            AND tm2.user_id = $2
            AND tm2.is_leader = TRUE
        ) AS is_leader
      FROM teams t
      JOIN team_members tm
        ON tm.team_id = t.id
      WHERE t.course_id = $1
        AND tm.user_id = $2
      ORDER BY t.display_number::int NULLS LAST, t.created_at ASC
    `,
    [effectiveCourseId, userIdToUse],
  );

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    displayNumber: r.display_number,
    status: r.status,
    description: r.description,
    repoUrl: r.repo_url || '',
    isLeader: r.is_leader,
  }));
}

module.exports = {
  // keep your other exports here:
  // getTeamCard,
  // updateTeamDescriptions,
  getTeamsForUser,
};
/**
 * Update only the description and status_description for a team.
 * Returns the refreshed team card payload (same shape as getTeamCard).
 */
async function updateTeamDescriptions(
  teamId,
  { description, statusDescription, repoUrl },
  courseIdOverride = null,
) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId || !teamId) return null;

  // Perform partial update (skip columns if undefined)
  await db.query(
    `UPDATE teams
     SET description = COALESCE($2, description),
       status_description = COALESCE($3, status_description),
       repo_url = COALESCE($4, repo_url)
     WHERE id = $1 AND course_id = $5`,
    [teamId,
     description !== undefined ? description : null,
     statusDescription !== undefined ? statusDescription : null,
     repoUrl !== undefined ? repoUrl : null,
     courseId]
  );

  return getTeamCard(teamId);
}

module.exports = {
  getTeamCard,
  getTeamsForUser,
  updateTeamDescriptions,
};
