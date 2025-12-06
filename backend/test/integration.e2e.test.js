const request = require('supertest');

// Ensure env is set before importing the app so routes think DB is configured.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://adityamelkote@localhost/conductor';
process.env.DEFAULT_COURSE_ID =
  process.env.DEFAULT_COURSE_ID || '22222222-2222-2222-2222-222222222222';

const app = require('../server');
const db = require('../db/index');

describe('Auth API', () => {
  test('resolves professor login', async () => {
    const res = await request(app)
      .post('/api/auth/resolve-login')
      .send({ email: 'professor@school.edu' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.primaryRole).toBe('professor');
    expect(res.body.redirectPath).toBe('/dashboards/professor.html');
  });

  test('rejects missing email', async () => {
    const res = await request(app).post('/api/auth/resolve-login').send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Email is required/i);
  });

  test('unknown user returns 404', async () => {
    const res = await request(app)
      .post('/api/auth/resolve-login')
      .send({ email: 'nobody@example.com' });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Team card authorization', () => {
  const teamId = '33333333-3333-3333-3333-333333333333';
  let originalCard;

  beforeAll(async () => {
    const res = await request(app).get(`/api/team-card/${teamId}`);
    originalCard = res.body;
  });

  test('student cannot update team card', async () => {
    const res = await request(app)
      .put(`/api/team-card/${teamId}`)
      .send({
        description: 'Should fail',
        statusDescription: 'Not allowed',
        repoUrl: 'https://example.com/forbidden',
        email: 'student@school.edu',
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Not authorized/i);
  });

  test('professor can update and revert team card', async () => {
    const update = await request(app)
      .put(`/api/team-card/${teamId}`)
      .send({
        description: 'Automated test description',
        statusDescription: 'Automated status',
        repoUrl: 'https://example.com/test-repo',
        email: 'professor@school.edu',
      });

    expect(update.statusCode).toBe(200);
    expect(update.body.success).toBe(true);
    expect(update.body.team.description).toBe('Automated test description');

    // Restore the original payload so tests are idempotent
    await request(app)
      .put(`/api/team-card/${teamId}`)
      .send({
        description: originalCard.description,
        statusDescription: originalCard.statusDescription,
        repoUrl: originalCard.repoUrl,
        email: 'professor@school.edu',
      });
  });
});

describe('Attendance flow', () => {
  let sessionCode;

  test('creates a new attendance session', async () => {
    const res = await request(app)
      .post('/api/attendance/sessions')
      .send({ durationMinutes: 30 });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.code).toHaveLength(6);
    sessionCode = res.body.code;
  });

  test('marks attendance and returns history', async () => {
    const mark = await request(app)
      .post('/api/attendance/mark')
      .send({ code: sessionCode, email: 'student@school.edu' });

    expect(mark.statusCode).toBe(200);
    expect(mark.body.success).toBe(true);

    const history = await request(app)
      .get('/api/attendance/history')
      .query({ email: 'student@school.edu' });

    expect(history.statusCode).toBe(200);
    expect(history.body.presentCount).toBeGreaterThanOrEqual(1);
    expect(history.body.sessions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Tasks board', () => {
  const storyName = `Story Test ${Date.now()}`;
  let originalBoard = {};

  beforeAll(async () => {
    const res = await request(app).get('/api/tasks');
    originalBoard = res.body || {};
  });

  test('overwrites tasks and reads them back', async () => {
    const payload = {
      [storyName]: {
        todo: [{ title: 'Task A', badge: 'high', due: 'TBD', assignee: 'None' }],
        progress: [],
        done: [],
      },
    };

    const write = await request(app).put('/api/tasks').send(payload);
    expect(write.statusCode).toBe(200);
    expect(write.body.message).toMatch(/Tasks updated/i);

    const read = await request(app).get('/api/tasks');
    expect(read.statusCode).toBe(200);
    expect(read.body[storyName].todo[0].title).toBe('Task A');
  });

  afterAll(async () => {
    // Restore original board to avoid polluting data across runs
    await request(app).put('/api/tasks').send(originalBoard);
  });
});

describe('Class directory', () => {
  test('returns course overview', async () => {
    const res = await request(app).get('/api/class-directory/course');
    expect(res.statusCode).toBe(200);
    expect(res.body.course_code).toBe('CSE210');
  });
});

afterAll(async () => {
  // Close pg pool so Jest exits cleanly.
  await db.pool.end();
});
