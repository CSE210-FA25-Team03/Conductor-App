// backend/db/journalReplies.js

const db = require('./index');

/**
 * Helper: ensure a user exists for the given email.
 * - If found, returns { id, email, display_name }
 * - If not found, creates a minimal users row and returns it.
 */
async function ensureUserByEmail(emailRaw) {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!email) {
    throw new Error('author email is required for journal reply');
  }

  // Check existing
  const { rows: existing } = await db.query(
    `
      SELECT id, email, display_name
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
    `,
    [email],
  );

  if (existing.length) {
    return existing[0];
  }

  // Create a minimal user
  const displayName = email.split('@')[0] || 'Staff';
  const { rows } = await db.query(
    `
      INSERT INTO users (email, display_name, given_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, display_name
    `,
    [email, displayName, displayName],
  );

  return rows[0];
}

/**
 * Get replies for a single work journal entry.
 */
async function getRepliesForJournal(journalId) {
  if (!journalId) return [];

  const { rows } = await db.query(
    `
      SELECT
        jr.id,
        jr.journal_id,
        jr.author_id,
        jr.body,
        jr.created_at,
        u.display_name AS author_name,
        u.email        AS author_email
      FROM journal_replies jr
      JOIN users u ON u.id = jr.author_id
      WHERE jr.journal_id = $1
      ORDER BY jr.created_at ASC
    `,
    [journalId],
  );

  return rows.map((row) => ({
    id: row.id,
    journalId: row.journal_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    authorName: row.author_name,
    authorEmail: row.author_email,
  }));
}

/**
 * Create a reply for a work journal.
 * data: { body, email? , authorId? }
 */
async function createReplyForJournal(journalId, data = {}) {
  if (!journalId) {
    throw new Error('journalId is required to create a reply');
  }

  const body = (data.body || '').trim();
  if (!body) {
    throw new Error('body is required to create a reply');
  }

  let authorId = data.authorId || null;

  if (!authorId) {
    // Resolve author from email
    if (!data.email) {
      throw new Error('either authorId or email is required to create a reply');
    }
    const user = await ensureUserByEmail(data.email);
    authorId = user.id;
  }

  // Insert reply
  const { rows: inserted } = await db.query(
    `
      INSERT INTO journal_replies (journal_id, author_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, journal_id, author_id, body, created_at
    `,
    [journalId, authorId, body],
  );

  const reply = inserted[0];

  // Load with author details
  const { rows } = await db.query(
    `
      SELECT
        jr.id,
        jr.journal_id,
        jr.author_id,
        jr.body,
        jr.created_at,
        u.display_name AS author_name,
        u.email        AS author_email
      FROM journal_replies jr
      JOIN users u ON u.id = jr.author_id
      WHERE jr.id = $1
      LIMIT 1
    `,
    [reply.id],
  );

  const row = rows[0];

  return {
    id: row.id,
    journalId: row.journal_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    authorName: row.author_name,
    authorEmail: row.author_email,
  };
}

module.exports = {
  getRepliesForJournal,
  createReplyForJournal,
};
