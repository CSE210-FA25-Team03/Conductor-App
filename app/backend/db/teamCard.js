// backend/db/teamCard.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getTeamCard(teamId) {
  const courseId = getCurrentCourseId();
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

async function getTeamsForUser({ email, userId }) {
  const courseId = getCurrentCourseId();
  if (!courseId || (!email && !userId)) return [];

  let resolvedUserId = userId;
  if (!resolvedUserId && email) {
    const { rows } = await db.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (!rows.length) return [];
    resolvedUserId = rows[0].id;
  }
  if (!resolvedUserId) return [];

  const { rows: teamRows } = await db.query(
    `SELECT t.id,
            t.code,
            t.name,
            t.display_number,
            t.status,
            t.description,
            t.status_description,
            t.repo_url
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1 AND t.course_id = $2
     ORDER BY t.created_at ASC`,
    [resolvedUserId, courseId]
  );

  if (!teamRows.length) return [];

  // Preload all member lists & TA assignments for returned teams
  const teamIds = teamRows.map(t => t.id);

  const { rows: allMembers } = await db.query(
    `SELECT tm.team_id,
            tm.user_id AS id,
            u.display_name AS name,
            u.email,
            tm.is_leader
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ANY($1::uuid[])`,
    [teamIds]
  );

  const { rows: allTas } = await db.query(
    `SELECT taa.team_id, u.id, u.display_name, u.email
     FROM team_ta_assignments taa
     JOIN users u ON u.id = taa.ta_user_id
     WHERE taa.team_id = ANY($1::uuid[])`,
    [teamIds]
  );

  return teamRows.map(t => ({
    id: t.id,
    code: t.code,
    name: t.name,
    displayNumber: t.display_number,
    status: t.status,
    description: t.description || '',
    statusDescription: t.status_description || '',
    repoUrl: t.repo_url || '',
    ta: (allTas.find(x => x.team_id === t.id) ? {
      id: allTas.find(x => x.team_id === t.id).id,
      name: allTas.find(x => x.team_id === t.id).display_name,
      email: allTas.find(x => x.team_id === t.id).email,
    } : null),
    members: allMembers.filter(m => m.team_id === t.id).map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      isLeader: m.is_leader,
    }))
  }));
}

/**
 * Update only the description and status_description for a team.
 * Returns the refreshed team card payload (same shape as getTeamCard).
 */
async function updateTeamDescriptions(teamId, { description, statusDescription, repoUrl }) {
  const courseId = getCurrentCourseId();
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
