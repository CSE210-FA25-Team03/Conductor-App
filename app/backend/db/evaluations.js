// backend/db/evaluations.js
const db = require('./index');

async function getEvaluationReportsForMember(courseId, userId) {
  const { rows } = await db.query(
    `
    SELECT er.week_label AS "weekLabel",
           er.status,
           er.mood,
           er.notes,
           er.updated_at AS "updatedAt",
           t.name AS "teamName",
           er.team_role AS "teamRole"
    FROM evaluation_reports er
    LEFT JOIN teams t ON er.team_id = t.id
    WHERE er.course_id = $1
      AND er.user_id = $2
    ORDER BY er.created_at DESC
    `,
    [courseId, userId],
  );

  if (!rows.length) {
    return {
      memberId: userId,
      teamName: null,
      teamRole: null,
      reports: [],
    };
  }

  const { teamName, teamRole } = rows[0];

  return {
    memberId: userId,
    teamName,
    teamRole,
    reports: rows.map(r => ({
      weekLabel: r.weekLabel,
      status: r.status,
      mood: r.mood,
      notes: r.notes,
      updatedAt: r.updatedAt,
    })),
  };
}

module.exports = {
  getEvaluationReportsForMember,
};
