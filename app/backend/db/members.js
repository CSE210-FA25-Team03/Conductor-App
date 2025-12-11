// backend/db/members.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getMembers(courseIdOverride) {
  const courseId = courseIdOverride || getCurrentCourseId();
  if (!courseId) return [];

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
    JOIN users u
      ON cm.user_id = u.id
    LEFT JOIN role_assignments ra
      ON ra.user_id = u.id
     AND ra.scope_type = 'course'
     AND ra.scope_id = cm.course_id
    LEFT JOIN roles r
      ON r.id = ra.role_id
    LEFT JOIN team_members tm
      ON tm.user_id = u.id
    WHERE cm.course_id = $1
    ORDER BY u.display_name
    `,
    [courseId],
  );

  return rows.map((r) => {
    let finalRole = r.role || 'student';
    if (finalRole === 'team_lead') {
      // already explicit
    } else if (r.is_leader && finalRole === 'student') {
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