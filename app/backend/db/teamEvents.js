// backend/db/teamEvents.js
const db = require('./index');
// const { getCurrentCourseId } = require('./classDirectory');

// Create table if it does not exist (lightweight migration)
async function ensureTeamEventsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS team_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      title text NOT NULL,
      type text NOT NULL CHECK (type IN ('meeting','task')),
      starts_at timestamptz,
      repeat_weekly boolean NOT NULL DEFAULT false,
      audience_tag text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function createTeamEvent({ teamId, creatorEmail, title, type, startsAt, repeatWeekly, audienceTag, notes }) {
  if (!teamId || !title) return null;
  await ensureTeamEventsTable();

  // Resolve creator user id
  let createdBy = null;
  if (creatorEmail) {
    const { rows } = await db.query(`SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [creatorEmail]);
    if (rows.length) createdBy = rows[0].id;
  }

  const { rows } = await db.query(
    `INSERT INTO team_events (
       team_id, created_by, title, type, starts_at, repeat_weekly, audience_tag, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, team_id AS "teamId", title, type, starts_at AS "startsAt",
               repeat_weekly AS "repeatWeekly", audience_tag AS "audienceTag",
               notes, created_at AS "createdAt"`
    , [teamId, createdBy, title, type || 'meeting', startsAt || null, !!repeatWeekly, audienceTag || null, notes || null]
  );
  return rows[0] || null;
}

async function getEventsForTeam(teamId) {
  if (!teamId) return [];
  await ensureTeamEventsTable();
  const { rows } = await db.query(
    `SELECT id, team_id AS "teamId", title, type, starts_at AS "startsAt",
            repeat_weekly AS "repeatWeekly", audience_tag AS "audienceTag",
            notes, created_at AS "createdAt"
     FROM team_events
     WHERE team_id = $1
     ORDER BY starts_at NULLS LAST, created_at ASC`,
    [teamId]
  );
  return rows;
}

async function getEventsForUserTeams(userEmail) {
  if (!userEmail) return [];
  await ensureTeamEventsTable();
  // Find teams (include leader flag) for this user
  const { rows: teamRows } = await db.query(
    `SELECT t.id, tm.is_leader
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       JOIN teams t ON t.id = tm.team_id
      WHERE LOWER(u.email) = LOWER($1)`,
    [userEmail]
  );
  if (!teamRows.length) return [];
  const teamIds = teamRows.map(r => r.id);
  const { rows: eventRows } = await db.query(
    `SELECT id, team_id AS "teamId", title, type, starts_at AS "startsAt",
            repeat_weekly AS "repeatWeekly", audience_tag AS "audienceTag",
            notes, created_at AS "createdAt"
       FROM team_events
      WHERE team_id = ANY($1::uuid[])
      ORDER BY starts_at NULLS LAST, created_at ASC`,
    [teamIds]
  );
  const lowerEmail = userEmail.toLowerCase();
  // Filter: targeted member events only visible to that member OR team leader of that team
  return eventRows.filter(evt => {
    const tag = (evt.audienceTag || '').trim().toLowerCase();
    if (!tag || tag === 'team') return true; // whole team
    if (tag.startsWith('member:')) {
      const targetEmail = tag.slice('member:'.length);
      if (targetEmail === lowerEmail) return true; // recipient
      // leader visibility
      const teamInfo = teamRows.find(tr => tr.id === evt.teamId);
      if (teamInfo && teamInfo.is_leader) return true;
      return false; // hide from other members
    }
    // Unknown tag: hide by default
    return false;
  });
}

module.exports = {
  createTeamEvent,
  getEventsForTeam,
  getEventsForUserTeams,
};