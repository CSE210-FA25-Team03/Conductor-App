const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');

// --- Health check ---
test('GET /api/health returns { status: "ok" }', async () => {
  const res = await request(app).get('/api/health');

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { status: 'ok' });
});

// --- Teams endpoint ---
test('GET /api/teams returns an array', async () => {
  const res = await request(app).get('/api/teams');

  assert.strictEqual(res.statusCode, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 0);

  if (res.body.length > 0) {
    assert.ok('id' in res.body[0]);
  }
});
