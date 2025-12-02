// backend/db/members.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getMembers() {
  const courseId = getCurrentCourseId();
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.display_name AS name,
      u.email,
      substring(u.display_name from 1 for 2) AS initials,
      r.key AS role,
      CASE WHEN tm.is_leader THEN true ELSE false END AS is_leader
    FROM course_memberships cm
    JOIN users u ON cm.user_id = u.id
    LEFT JOIN role_assignments ra
      ON ra.user_id = u.id
     AND ra.scope_type = 'course'
     AND ra.scope_id = cm.course_id
    LEFT JOIN roles r ON ra.role_id = r.id
    LEFT JOIN team_members tm
      ON tm.user_id = u.id
    LEFT JOIN teams t
      ON t.id = tm.team_id AND t.course_id = cm.course_id
    WHERE cm.course_id = $1
    GROUP BY u.id, u.display_name, u.email, initials, r.key, is_leader
    ORDER BY u.display_name
    `,
    [courseId],
  );

  return rows.map((r) => {
    let finalRole = r.role || 'student';
    if (r.is_leader && !['professor', 'ta', 'tutor'].includes(finalRole)) {
      finalRole = 'team_lead';
    }
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      initials: (r.initials || '').toUpperCase(),
      role: finalRole,
      isLeader: r.is_leader,
    };
  });
}

module.exports = {
  getMembers,
};
