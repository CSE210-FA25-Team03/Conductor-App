// // backend/db/index.js
// const { Pool } = require('pg');

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL || 'postgres://abhishekdhaka@localhost/conductor',
//   // You can also use { user, host, database, password, port } if you prefer.
// });

// async function query(text, params) {
//   const result = await pool.query(text, params);
//   return result;
// }

// async function getClient() {
//   if (!connectionString) {
//     throw new Error('DATABASE_URL is not configured');
//   }
//   return pool.connect();
// }

// module.exports = {
//   query,
//     getClient,
// };
// backend/db/index.js

const { query, pool } = require('../db');

async function getClient() {
  return pool.connect();
}

module.exports = {
  query,
  getClient,
  pool,
};