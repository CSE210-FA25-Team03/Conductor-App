const classDirectoryDb = require('../db/classDirectory');
const { findRoleForEmail } = require('../routes/auth');

jest.mock('../db/classDirectory');

const users = require('./fixtures/users');
const courses = require('./fixtures/courses');

describe('findRoleForEmail', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns enrolled=false, nulls when user not found', async () => {
    classDirectoryDb.getUserCourseContextByEmail.mockResolvedValue(null);

    const result = await findRoleForEmail('nobody@school.edu');

    expect(result).toEqual({
      enrolled: false,
      role: null,
      user: null,
      course: null,
    });
  });

  test('student exists but not in requested course CSE110 → enrolled=false, course=null', async () => {
    classDirectoryDb.getUserCourseContextByEmail.mockResolvedValue({
      user: {
        id: users.student.id,
        email: users.student.email,
        displayName: users.student.displayName,
      },
      inCourse: false,
      primaryRole: 'student',
      roles: ['student'],
      courseId: courses.CSE110.id,
      courseCode: courses.CSE110.code,
      courseName: courses.CSE110.name,
    });

    const result = await findRoleForEmail(users.student.email, {
      classCode: courses.CSE110.code,
    });

    expect(result.enrolled).toBe(false);
    expect(result.role).toBeNull();
    expect(result.course).toBeNull();
    expect(result.user).toEqual({
      id: users.student.id,
      email: users.student.email,
      displayName: users.student.displayName,
    });
  });

  test('student in correct course CSE210 → enrolled=true, role=student', async () => {
    classDirectoryDb.getUserCourseContextByEmail.mockResolvedValue({
      user: {
        id: users.student.id,
        email: users.student.email,
        displayName: users.student.displayName,
      },
      inCourse: true,
      primaryRole: 'student',
      roles: ['student'],
      courseId: courses.CSE210.id,
      courseCode: courses.CSE210.code,
      courseName: courses.CSE210.name,
    });

    const result = await findRoleForEmail(users.student.email, {
      classCode: courses.CSE210.code,
    });

    expect(result.enrolled).toBe(true);
    expect(result.role).toBe('student');
    expect(result.user).toEqual({
      id: users.student.id,
      email: users.student.email,
      display_name: users.student.displayName,
      displayName: users.student.displayName,
    });
    expect(result.course).toEqual(courses.CSE210);
  });

  test('admin not in course → enrolled=true, role=admin', async () => {
  classDirectoryDb.getUserCourseContextByEmail.mockResolvedValue({
    user: {
      id: users.admin.id,
      email: users.admin.email,
      displayName: users.admin.displayName,
    },
    inCourse: false, 
    primaryRole: 'admin',
    roles: ['admin'],
    courseId: courses.CSE210.id,
    courseCode: courses.CSE210.code,
    courseName: courses.CSE210.name,
  });

  const result = await findRoleForEmail(users.admin.email, {
    classCode: courses.CSE210.code,
  });

  expect(result.enrolled).toBe(true);
  expect(result.role).toBe('admin');
  expect(result.user).toEqual({
    id: users.admin.id,
    email: users.admin.email,
    display_name: users.admin.displayName,
    displayName: users.admin.displayName,
  });
  expect(result.course).toEqual(courses.CSE210);
});

});
