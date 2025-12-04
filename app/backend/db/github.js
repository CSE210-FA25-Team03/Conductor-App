// backend/db/github.js
const db = require('./index');
const { getCurrentCourseId } = require('./classDirectory');

async function getGithubConfig() {
  const courseId = getCurrentCourseId();
  const { rows } = await db.query(
    `
    SELECT owner, repo, token, project_id
    FROM github_configs
    WHERE course_id = $1
    `,
    [courseId],
  );
  if (!rows.length) {
    return { owner: '', repo: '', token: '', project_id: null };
  }
  return rows[0];
}

async function upsertGithubConfig({ owner, repo, token, project_id }) {
  const courseId = getCurrentCourseId();

  const { rows } = await db.query(
    `
    INSERT INTO github_configs (course_id, owner, repo, token, project_id)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (course_id)
    DO UPDATE SET owner = EXCLUDED.owner,
                  repo = EXCLUDED.repo,
                  token = EXCLUDED.token,
                  project_id = EXCLUDED.project_id,
                  updated_at = now()
    RETURNING owner, repo, token, project_id
    `,
    [courseId, owner, repo, token, project_id || null],
  );
  return rows[0];
}

module.exports = {
  getGithubConfig,
  upsertGithubConfig,
};
