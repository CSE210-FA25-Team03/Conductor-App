// app/backend/test/auth.routes.test.js

const request = require('supertest');
const app = require('../server'); // adjust if your server file has a different name

describe('Auth routes', () => {
  test('GET /auth/me without session → 401 unauthenticated', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ authenticated: false });
  });

  test('GET /auth/me with session user → 200 authenticated', async () => {
    // Use agent so cookies (session) persist between calls
    const agent = request.agent(app);

    // 1) Call test helper to fake-login and set req.session.user
    await agent.post('/test/fake-login').send();

    // 2) Now /auth/me should see the user
    const res = await agent.get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user).toMatchObject({
      email: 'student@school.edu',
      role: 'student',
    });
  });

  test('POST /auth/logout clears session', async () => {
    const agent = request.agent(app);

    // 1) Fake login
    await agent.post('/test/fake-login').send();

    // 2) Confirm logged in
    const before = await agent.get('/auth/me');
    expect(before.status).toBe(200);
    expect(before.body.authenticated).toBe(true);

    // 3) Logout
    const logoutRes = await agent.post('/auth/logout').send();
    expect(logoutRes.status).toBe(204);

    // 4) Now /auth/me should say unauthenticated
    const after = await agent.get('/auth/me');
    expect(after.status).toBe(401);
    expect(after.body).toEqual({ authenticated: false });
  });

  test('GET /auth/google/callback with invalid state → 400 "Invalid state"', async () => {
    // No session.oauthState set → any state in query should be invalid
    const res = await request(app).get(
      '/auth/google/callback?code=abc123&state=wrong'
    );

    expect(res.status).toBe(400);
    expect(res.text).toBe('Invalid state');
  });
});
