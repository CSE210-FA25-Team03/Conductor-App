const request = require('supertest');
const app = require('../server');

// --- Health check ---
describe('Health API', () => {
  test('GET /api/health returns { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// --- Teams endpoint ---
describe('Teams API', () => {
  test('GET /api/teams returns an array', async () => {
    const res = await request(app).get('/api/teams');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(0);

    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
    }
  });
});
