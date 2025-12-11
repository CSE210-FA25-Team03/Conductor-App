// // backend/db/index.js

const { query, pool } = require('../db');

async function getClient() {
  return pool.connect();
}

module.exports = {
  query,
  getClient,
  pool,
};