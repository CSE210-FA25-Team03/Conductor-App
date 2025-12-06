// backend/db/faqs.js
const db = require('./index');

// id (PRIMARY KEY), question, answer
async function getAllFaqs() {
  const result = await db.query('SELECT * FROM faqs');
  return result.rows;
}

async function getFaqById(id) {
  const result = await db.query('SELECT * FROM faqs WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createFaq(faqData) {
    const { question, answer } = faqData;
    const result = await db.query(
        'INSERT INTO faqs (question, answer) VALUES ($1, $2) RETURNING *',
        [question, answer]
    );
    return result.rows[0];
}

async function updateFaqById(id, faqData) {
    const { question, answer } = faqData;
    const result = await db.query(
        'UPDATE faqs SET question = $1, answer = $2 WHERE id = $3 RETURNING *',
        [question, answer, id]
    );
    return result.rows[0] || null;
}

async function deleteFaqById(id) {
    const result = await db.query(
        'DELETE FROM faqs WHERE id = $1 RETURNING *',
        [id]
    );
    return result.rows[0] || null;
}

module.exports = {
  getAllFaqs,
  getFaqById,
  createFaq,
  updateFaqById,
  deleteFaqById,
};