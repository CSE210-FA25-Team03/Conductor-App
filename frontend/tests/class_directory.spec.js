import { describe, it, expect, beforeEach, vi } from 'vitest';

const directoryResponse = {
  course: {
    course_code: 'CSE210',
    term_year: 'FA25',
    description: 'Test course',
  },
  instructors: [{ name: 'Prof One', email: 'prof@example.com', pronouns: 'she/her' }],
  TAs: [{ name: 'TA One', email: 'ta@example.com' }],
  tutors: [],
  Teams: [{ name: 'Team 1', teamNumber: 'TEAM-1', status: 'On Track' }],
};

const eventsResponse = [
  {
    id: 'evt1',
    title: 'Milestone',
    dueDate: '2025-12-10T00:00:00Z',
    description: 'First milestone',
    type: 'Assignment',
  },
];

function buildDom() {
  document.body.innerHTML = `
    <button id="back-btn"></button>
    <button id="addGoogleCalBtn"></button>
    <div id="courseCode"></div>
    <div id="courseTerm"></div>
    <div id="summaryTerm"></div>
    <div id="summaryTitle"></div>
    <div id="courseDescription"></div>
    <div id="summaryStaffCount"></div>
    <div id="instructorsList"></div>
    <div id="tasList"></div>
    <div id="tutorsList"></div>
    <div id="teamsList"></div>
    <div id="eventsList"></div>
    <div id="calendar"></div>
    <form id="team-form"></form>
    <form id="event-form">
      <input id="eventDueDate" />
      <input id="eventTitle" />
      <input id="eventDescription" />
      <select id="eventType"><option value="Assignment">Assignment</option></select>
    </form>
  `;
}

describe('class directory page script', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('role', 'professor');
    buildDom();

    // Stub alert to avoid modal during tests
    vi.stubGlobal('alert', vi.fn());

    // Stub FullCalendar
    class FakeCalendar {
      constructor() {
        this.events = [];
      }
      render() {}
      removeAllEvents() {
        this.events = [];
      }
      addEvent(evt) {
        this.events.push(evt);
      }
    }
    vi.stubGlobal('FullCalendar', { Calendar: FakeCalendar });

    // Stub fetch for directory and events
    const fetchMock = vi.fn((url) => {
      if (url.includes('/api/class_directory')) {
        return Promise.resolve(
          new Response(JSON.stringify(directoryResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.includes('/api/class-directory/events')) {
        return Promise.resolve(
          new Response(JSON.stringify(eventsResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads course, staff, teams, and events', async () => {
    await import('../src/pages/class_directory/script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Allow async fetch handlers to complete
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById('courseCode').textContent).toBe('CSE210');
    expect(document.getElementById('courseTerm').textContent).toBe('FA25');
    expect(document.getElementById('summaryStaffCount').textContent).toBe('2');

    expect(document.getElementById('instructorsList').textContent).toContain('Prof One');
    expect(document.getElementById('tasList').textContent).toContain('TA One');

    expect(document.getElementById('teamsList').textContent).toContain('Team 1');
    expect(document.getElementById('eventsList').textContent).toContain('Milestone');
  });
});
