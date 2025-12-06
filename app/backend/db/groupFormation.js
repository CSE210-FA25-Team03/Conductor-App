// backend/db/groupFormation.js
const db = require('./index');

// ------------------------------------------------------------
// Helper: resolve user_id from either userId or email
// ------------------------------------------------------------

async function resolveUserId({ userId, email }) {
  if (userId) {
    return userId;
  }

  if (!email) {
    throw new Error('userId or email is required to save skill ratings');
  }

  const normalized = email.trim().toLowerCase();

  const { rows } = await db.query(
    `
    SELECT id
    FROM users
    WHERE LOWER(email) = $1
    LIMIT 1
    `,
    [normalized],
  );

  if (!rows.length) {
    throw new Error(`No user found for email ${normalized}`);
  }

  return rows[0].id;
}

// ------------------------------------------------------------
// Skills
// ------------------------------------------------------------

async function getSkills(courseId) {
  if (!courseId) return [];

  const { rows } = await db.query(
    `
    SELECT
      id,
      name,
      description,
      weight,
      position
    FROM skills
    WHERE course_id = $1
    ORDER BY position ASC, created_at ASC
    `,
    [courseId],
  );
  return rows;
}

async function upsertSkill(courseId, skill) {
  if (!courseId) {
    throw new Error('courseId is required to upsert a skill');
  }

  const {
    id,
    name,
    description = '',
    weight = 0,
    position = 0,
  } = skill;

  if (!name || typeof name !== 'string') {
    throw new Error('Skill name is required');
  }

  // -----------------------------
  // UPDATE existing skill
  // -----------------------------
  if (id) {
    const { rows } = await db.query(
      `
      UPDATE skills
      SET
        name        = $2,
        description = $3,
        weight      = $4,
        position    = $5,
        updated_at  = now()
      WHERE id = $1
        AND course_id = $6
      RETURNING *
      `,
      [id, name, description, weight, position, courseId],
    );
    return rows[0];
  }

  // -----------------------------
  // INSERT new skill
  // -----------------------------
  const { rows } = await db.query(
    `
    INSERT INTO skills (course_id, name, description, weight, position)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [courseId, name, description, weight, position],
  );

  const createdSkill = rows[0];

  // Seed DEFAULT rating = 2 for ALL STUDENTS in this course
  await db.query(
    `
    INSERT INTO skill_ratings (
      course_id,
      user_id,
      skill_id,
      rating,
      rating_type,
      updated_at
    )
    SELECT
      cm.course_id,
      cm.user_id,
      $2 AS skill_id,
      2   AS rating,
      'student' AS rating_type,
      now() AS updated_at
    FROM course_memberships cm
    JOIN users u
      ON u.id = cm.user_id
    LEFT JOIN role_assignments ra
      ON ra.user_id   = u.id
     AND ra.scope_type = 'course'
     AND ra.scope_id   = cm.course_id
    LEFT JOIN roles r
      ON r.id = ra.role_id
    LEFT JOIN skill_ratings existing
      ON existing.course_id   = cm.course_id
     AND existing.user_id     = cm.user_id
     AND existing.skill_id    = $2
     AND existing.rating_type = 'student'
    WHERE cm.course_id = $1
      AND (r.key IS NULL OR r.key = 'student')
      AND existing.id IS NULL
    `,
    [courseId, createdSkill.id],
  );

  return createdSkill;
}

async function deleteSkill(courseId, id) {
  if (!courseId) {
    throw new Error('courseId is required to delete a skill');
  }
  if (!id) {
    throw new Error('skill id is required');
  }
  const { rowCount } = await db.query(
    `
    DELETE FROM skills
    WHERE id = $1 AND course_id = $2
    `,
    [id, courseId],
  );
  return rowCount > 0;
}

// ------------------------------------------------------------
// Ratings – professor view (ALL students, with default = 2)
// ------------------------------------------------------------

async function getStudentRatings(courseId) {
  if (!courseId) return [];

  const { rows } = await db.query(
    `
    SELECT
      u.id           AS user_id,
      u.display_name AS name,
      u.email        AS email,
      COALESCE(
        jsonb_object_agg(
          s.name,
          COALESCE(sr.rating, 2)
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
      ) AS ratings
    FROM course_memberships cm
    JOIN users u
      ON u.id = cm.user_id
    LEFT JOIN role_assignments ra
      ON ra.user_id   = u.id
     AND ra.scope_type = 'course'
     AND ra.scope_id   = cm.course_id
    LEFT JOIN roles r
      ON r.id = ra.role_id
    LEFT JOIN skills s
      ON s.course_id = cm.course_id
    LEFT JOIN skill_ratings sr
      ON sr.course_id   = cm.course_id
     AND sr.user_id     = u.id
     AND sr.skill_id    = s.id
     AND sr.rating_type = 'student'
    WHERE cm.course_id = $1
      AND (r.key IS NULL OR r.key = 'student')
    GROUP BY u.id, u.display_name, u.email
    ORDER BY u.display_name
    `,
    [courseId],
  );

  return rows;
}

// ------------------------------------------------------------
// Ratings – student view (current student, default = 2)
// ------------------------------------------------------------

/**
 * Returns an object: { [skillId]: rating }
 * Includes ALL skills for this course; missing ratings default to 2.
 */
async function getStudentRatingsForUser(courseId, { userId, email }) {
  if (!courseId) return {};

  const resolvedUserId = await resolveUserId({ userId, email });

  const { rows } = await db.query(
    `
    SELECT
      s.id AS skill_id,
      COALESCE(sr.rating, 2) AS rating
    FROM skills s
    LEFT JOIN skill_ratings sr
      ON sr.course_id   = s.course_id
     AND sr.user_id     = $2
     AND sr.skill_id    = s.id
     AND sr.rating_type = 'student'
    WHERE s.course_id = $1
    ORDER BY s.position ASC, s.created_at ASC
    `,
    [courseId, resolvedUserId],
  );

  const map = {};
  for (const row of rows) {
    map[row.skill_id] = row.rating;
  }
  return map;
}

/**
 * upsertStudentRating(courseId, { userId?, email?, skillRatings })
 *
 * skillRatings: { [skillId]: ratingNumber }
 * ratingNumber is clamped to 1–4.
 */
async function upsertStudentRating(courseId, { userId, email, skillRatings }) {
  if (!courseId) {
    throw new Error('courseId is required to save student ratings');
  }

  const resolvedUserId = await resolveUserId({ userId, email });
  const entries = Object.entries(skillRatings || {});

  if (!entries.length) return;

  await Promise.all(
    entries.map(([skillId, raw]) => {
      let rating = parseInt(raw, 10);
      if (!Number.isFinite(rating)) rating = 0;
      if (rating < 1) rating = 1;
      if (rating > 4) rating = 4;

      return db.query(
        `
        INSERT INTO skill_ratings (
          course_id,
          user_id,
          skill_id,
          rating,
          rating_type,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'student', now())
        ON CONFLICT (course_id, user_id, skill_id, rating_type)
        DO UPDATE
          SET rating = EXCLUDED.rating,
              updated_at = now()
        `,
        [courseId, resolvedUserId, skillId, rating],
      );
    }),
  );
}

// ------------------------------------------------------------
// Ratings – team lead
// ------------------------------------------------------------

async function getTeamLeadRatings(courseId) {
  if (!courseId) return [];

  const { rows } = await db.query(
    `
    SELECT
      sr.user_id,
      u.display_name AS name,
      u.email,
      jsonb_object_agg(s.name, sr.rating ORDER BY s.position) AS ratings
    FROM skill_ratings sr
    JOIN skills s
      ON sr.skill_id = s.id
    JOIN users u
      ON sr.user_id = u.id
    WHERE sr.course_id = $1
      AND sr.rating_type = 'team_lead'
    GROUP BY sr.user_id, u.display_name, u.email
    ORDER BY u.display_name
    `,
    [courseId],
  );

  return rows;
}

/**
 * upsertTeamLeadRating(courseId, { userId?, email?, skillRatings })
 */
async function upsertTeamLeadRating(courseId, { userId, email, skillRatings }) {
  if (!courseId) {
    throw new Error('courseId is required to save team lead ratings');
  }

  const resolvedUserId = await resolveUserId({ userId, email });
  const entries = Object.entries(skillRatings || {});

  if (!entries.length) return;

  await Promise.all(
    entries.map(([skillId, raw]) => {
      let rating = parseInt(raw, 10);
      if (!Number.isFinite(rating)) rating = 0;
      if (rating < 1) rating = 1;
      if (rating > 4) rating = 4;

      return db.query(
        `
        INSERT INTO skill_ratings (
          course_id,
          user_id,
          skill_id,
          rating,
          rating_type,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'team_lead', now())
        ON CONFLICT (course_id, user_id, skill_id, rating_type)
        DO UPDATE
          SET rating = EXCLUDED.rating,
              updated_at = now()
        `,
        [courseId, resolvedUserId, skillId, rating],
      );
    }),
  );
}

// ------------------------------------------------------------
// Groups – teams, members, TA assignment (PERSISTED)
// ------------------------------------------------------------

/**
 * Get existing groups (teams) for a course.
 * Returns:
 * [
 *   {
 *     id,
 *     name,
 *     code,
 *     taUserId,
 *     taName,
 *     taEmail,
 *     members: [{ userId, name, email, role }]
 *   }
 * ]
 */
async function getGroups(courseId) {
  if (!courseId) return [];

  const { rows } = await db.query(
    `
    SELECT
      t.id          AS team_id,
      t.name        AS team_name,
      t.code        AS team_code,
      t.status      AS team_status,
      t.description AS team_description,

      tm.user_id    AS member_user_id,
      u.display_name AS member_name,
      u.email        AS member_email,
      tm.is_leader   AS member_is_leader,

      tta.ta_user_id  AS ta_user_id,
      ta.display_name AS ta_name,
      ta.email        AS ta_email
    FROM teams t
    LEFT JOIN team_members tm
      ON tm.team_id = t.id
    LEFT JOIN users u
      ON u.id = tm.user_id
    LEFT JOIN team_ta_assignments tta
      ON tta.team_id = t.id
    LEFT JOIN users ta
      ON ta.id = tta.ta_user_id
    WHERE t.course_id = $1
    ORDER BY t.display_number NULLS FIRST, t.name, member_name
    `,
    [courseId],
  );

  if (!rows.length) return [];

  const byTeam = new Map();

  for (const row of rows) {
    let team = byTeam.get(row.team_id);
    if (!team) {
      team = {
        id: row.team_id,
        name: row.team_name,
        code: row.team_code,
        status: row.team_status,
        description: row.team_description,
        taUserId: row.ta_user_id || null,
        taName: row.ta_name || null,
        taEmail: row.ta_email || null,
        members: [],
      };
      byTeam.set(row.team_id, team);
    }

    if (row.member_user_id) {
      team.members.push({
        userId: row.member_user_id,
        name: row.member_name,
        email: row.member_email,
        role: row.member_is_leader ? 'team_lead' : 'member',
      });
    }
  }

  return Array.from(byTeam.values());
}

/**
 * Save groups:
 * groups: [
 *   {
 *     teamName,
 *     taUserId,
 *     members: [{ userId, role }]
 *   }
 * ]
 *
 * Strategy (simpler + safe for now):
 *   - Delete existing teams/team_members/team_ta_assignments + team-level role_assignments
 *   - Recreate from payload
 */
async function saveGroups(courseId, groups = []) {
  if (!courseId) {
    throw new Error('courseId is required to save groups');
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Ensure team_lead role exists
    let { rows: roleRows } = await client.query(
      `SELECT id FROM roles WHERE key = 'team_lead' LIMIT 1`,
    );
    let teamLeadRoleId = roleRows[0]?.id || null;

    if (!teamLeadRoleId) {
      ({ rows: roleRows } = await client.query(
        `
        INSERT INTO roles (key, label)
        VALUES ('team_lead', 'Team Lead')
        RETURNING id
        `,
      ));
      teamLeadRoleId = roleRows[0].id;
    }

    // Fetch existing team IDs for this course
    const { rows: existingTeams } = await client.query(
      `
      SELECT id
      FROM teams
      WHERE course_id = $1
      `,
      [courseId],
    );
    const teamIds = existingTeams.map((r) => r.id);

    if (teamIds.length) {
      // Remove team-level role assignments first (scope_type='team')
      await client.query(
        `
        DELETE FROM role_assignments
        WHERE scope_type = 'team'
          AND scope_id = ANY($1::uuid[])
        `,
        [teamIds],
      );

      await client.query(
        `DELETE FROM team_ta_assignments WHERE team_id = ANY($1::uuid[])`,
        [teamIds],
      );
      await client.query(
        `DELETE FROM team_members WHERE team_id = ANY($1::uuid[])`,
        [teamIds],
      );
      await client.query(
        `DELETE FROM teams WHERE id = ANY($1::uuid[])`,
        [teamIds],
      );
    }

    // Insert new teams + members + TA assignments + team_lead role_assignments
    let teamIndex = 0;

    for (const group of groups) {
      teamIndex += 1;
      const teamName = group.teamName || `Team ${teamIndex}`;
      const teamCode = group.teamCode || `team-${teamIndex}`;
      const taUserId = group.taUserId || null;
      const members = Array.isArray(group.members) ? group.members : [];

      const { rows: teamRows } = await client.query(
        `
        INSERT INTO teams (
          course_id,
          code,
          name,
          status,
          description
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [courseId, teamCode, teamName, 'On Track', group.description || null],
      );

      const teamId = teamRows[0].id;

      if (taUserId) {
        await client.query(
          `
          INSERT INTO team_ta_assignments (team_id, ta_user_id)
          VALUES ($1, $2)
          ON CONFLICT (team_id)
          DO UPDATE SET ta_user_id = EXCLUDED.ta_user_id
          `,
          [teamId, taUserId],
        );
      }

      for (const member of members) {
        if (!member || !member.userId) continue;

        const isLeader = (member.role || '').toLowerCase() === 'team_lead';

        await client.query(
          `
          INSERT INTO team_members (team_id, user_id, is_leader)
          VALUES ($1, $2, $3)
          ON CONFLICT (team_id, user_id)
          DO UPDATE SET is_leader = EXCLUDED.is_leader
          `,
          [teamId, member.userId, isLeader],
        );

        if (isLeader && teamLeadRoleId) {
          await client.query(
            `
            INSERT INTO role_assignments (
              user_id,
              role_id,
              scope_type,
              scope_id
            )
            VALUES ($1, $2, 'team', $3)
            ON CONFLICT (user_id, role_id, scope_type, scope_id)
            DO NOTHING
            `,
            [member.userId, teamLeadRoleId, teamId],
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

module.exports = {
  getSkills,
  upsertSkill,
  deleteSkill,
  getStudentRatings,
  getStudentRatingsForUser,
  upsertStudentRating,
  getTeamLeadRatings,
  upsertTeamLeadRating,
  getGroups,
  saveGroups,
};
