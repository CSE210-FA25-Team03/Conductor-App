// backend/db/github.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getGithubConfig() {
  const courseId = getCurrentCourseId();
  const { rows } = await db.query(
    `
    SELECT owner, repo, token
    FROM github_configs
    WHERE course_id = $1
    `,
    [courseId],
  );
  if (!rows.length) {
    return { owner: '', repo: '', token: '' };
  }
  return rows[0];
}

async function upsertGithubConfig({ owner, repo, token }) {
  const courseId = getCurrentCourseId();

  const { rows } = await db.query(
    `
    INSERT INTO github_configs (course_id, owner, repo, token)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (course_id)
    DO UPDATE SET owner = EXCLUDED.owner,
                  repo = EXCLUDED.repo,
                  token = EXCLUDED.token,
                  updated_at = now()
    RETURNING owner, repo, token
    `,
    [courseId, owner, repo, token],
  );
  return rows[0];
}

module.exports = {
  getGithubConfig,
  upsertGithubConfig,
};
