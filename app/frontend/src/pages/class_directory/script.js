/* global FullCalendar */

/* ============================================================
   API ENDPOINTS
   ============================================================ */
const DIRECTORY_ENDPOINT = '/api/class_directory';
const TEAMS_ENDPOINT = '/api/class-directory/teams';
const EVENTS_ENDPOINT = '/api/class-directory/events';

const DEFAULT_AVATAR = '/assets/logo/user.png';

const STAFF_SECTIONS = {
  instructor: { listId: 'instructorsList' },
  ta: { listId: 'tasList' },
  tutor: { listId: 'tutorsList' }
};

let calendarInstance = null;
let cachedEvents = [];
let editingEventId = null;

/* ============================================================
   INITIALIZATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  wireNavigation();
  wireGoogleButton();
  initCalendar();

  if (!canManageDirectory()) {
    disableManagementUI();
  } else {
    bindTeamForm();
    bindEventForm();
  }

  loadClassDirectory();
  loadEvents();
});

function canManageDirectory() {
  const role = getUserRole();
  return role === 'professor' || role === 'teaching assistant';
}

function getUserRole() {
  return (localStorage.getItem('role') || '').trim().toLowerCase();
}

function disableManagementUI() {
  const selectors = [
    '#instructorForm',
    '#taForm',
    '#tutorForm',
    '#team-form',
    '#event-form',
    '[data-open-form]',
    '#addGoogleCalBtn'
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => (el.style.display = 'none'));
  });
}

function getDashboardUrl() {
  const role = getUserRole();
  if (role === 'professor') return '/dashboards/professor.html';
  if (role === 'teaching assistant') return '/dashboards/ta.html';
  if (role === 'team_lead') return '/dashboards/team_lead.html';
  return '/dashboards/student.html';
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function wireNavigation() {
  const back = document.getElementById('back-btn');
  if (back) {
    back.addEventListener('click', () => {
      window.location.href = getDashboardUrl();
    });
  }
}

function wireGoogleButton() {
  const btn = document.getElementById('addGoogleCalBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    alert('Google Calendar integration coming soon.');
  });
}

/* ============================================================
   CALENDAR
   ============================================================ */
function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || typeof FullCalendar === 'undefined') return;

  calendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    selectable: true,
    events: [],
    dateClick(info) {
      const due = document.getElementById('eventDueDate');
      if (due) due.value = toLocalInputValue(info.dateStr);
    },
    eventClick(info) {
      const evt = info.event;
      const due = new Date(evt.start).toLocaleString();
      const desc = evt.extendedProps?.description || '';

      const msg =
        `Deadline: ${evt.title}\nDue: ${due}` +
        (desc ? `\n\nDetails: ${desc}` : '') +
        `\n\nDelete this event?`;

      if (confirm(msg)) deleteEvent(evt.id);
    }
  });

  calendarInstance.render();
}

/* ============================================================
   TEAM FORM
   ============================================================ */
function bindTeamForm() {
  const form = document.getElementById('team-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      team_id: getInputValue('teamNumberInput'),
      team_name: getInputValue('teamNameInput')
    };

    if (!payload.team_id || !payload.team_name) {
      alert('Team number and name are required.');
      return;
    }

    try {
      await postJson(TEAMS_ENDPOINT, payload);
      form.reset();
      await loadClassDirectory();
    } catch (err) {
      console.error(err);
      alert('Failed to add team.');
    }
  });
}

/* ============================================================
   EVENT FORM
   ============================================================ */
function bindEventForm() {
  const form = document.getElementById('event-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawDate = getInputValue('eventDueDate');
    const payload = {
      title: getInputValue('eventTitle'),
      description: getInputValue('eventDescription'),
      dueDate: rawDate ? new Date(rawDate).toISOString() : '',
      type: document.getElementById('eventType')?.value || 'Other'
    };

    if (!payload.title || !payload.dueDate) {
      alert('Title and due date are required.');
      return;
    }

    try {
      if (editingEventId) {
        await putJson(`${EVENTS_ENDPOINT}/${editingEventId}`, payload);
      } else {
        await postJson(EVENTS_ENDPOINT, payload);
      }

      resetEventForm(form);
      await loadEvents();
    } catch (err) {
      console.error(err);
      alert('Failed to save event.');
    }
  });
}

function resetEventForm(form) {
  editingEventId = null;
  form.reset();
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.textContent = 'Save Event';
}

function startEditEvent(evt) {
  const form = document.getElementById('event-form');
  if (!form) return;

  editingEventId = evt.id;
  document.getElementById('eventTitle').value = evt.title || '';
  document.getElementById('eventDescription').value = evt.description || '';

  document.getElementById('eventDueDate').value = evt.dueDate
    ? new Date(evt.dueDate).toISOString().slice(0, 16)
    : '';

  document.getElementById('eventType').value = evt.type || 'Other';

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.textContent = 'Update Event';
}

/* ============================================================
   FETCH HELPERS
   ============================================================ */
function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putJson(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteRequest(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ============================================================
   LOADERS
   ============================================================ */
async function loadClassDirectory() {
  try {
    const res = await fetch(DIRECTORY_ENDPOINT);
    if (!res.ok) throw new Error('Failed to load directory');

    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : data;

    updateCourseInfo(entry?.course);
    renderStaffList('instructor', entry?.instructors);
    renderStaffList('ta', entry?.TAs);
    renderStaffList('tutor', entry?.tutors);
    renderTeams(entry?.Teams);
    updateSummaryStats(entry);
  } catch (e) {
    console.error('loadClassDirectory error', e);
  }
}

async function loadEvents() {
  try {
    const res = await fetch(EVENTS_ENDPOINT);
    const events = await res.json();

    cachedEvents = normalizeEvents(events);
    renderEventsList();
    syncCalendarEvents();
  } catch (e) {
    console.error('loadEvents error', e);
  }
}

function normalizeEvents(events = []) {
  return events.map(evt => ({
    ...evt,
    type: evt.type || 'Other'
  }));
}

/* ============================================================
   EVENTS RENDERING
   ============================================================ */
function syncCalendarEvents() {
  if (!calendarInstance) return;

  calendarInstance.removeAllEvents();

  cachedEvents.forEach(evt => {
    calendarInstance.addEvent({
      id: evt.id,
      title: evt.title,
      start: evt.dueDate,
      end: evt.dueDate,
      allDay: false,
      extendedProps: {
        description: evt.description || '',
        type: evt.type
      },
      color: eventColor(evt.type),
      textColor: '#0b132b'
    });
  });
}

function eventColor(type = '') {
  const t = type.toLowerCase();
  if (t === 'lecture') return '#9fe3ff';
  if (t === 'lab') return '#ffe89f';
  if (t === 'discussion') return '#d8d1ff';
  if (t === 'assignment') return '#c7f4d1';
  if (t === 'exam') return '#ffc9c9';
  return '#e0e7ff';
}

function renderEventsList() {
  const box = document.getElementById('eventsList');
  if (!box) return;

  box.innerHTML = '';

  if (!cachedEvents.length) {
    box.innerHTML = `<p class="empty-copy">No deadlines yet.</p>`;
    return;
  }

  const sorted = [...cachedEvents].sort(
    (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
  );

  sorted.forEach(evt => {
    const card = document.createElement('div');
    card.className = 'event-card';

    const due = new Date(evt.dueDate).toLocaleString();

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <strong>${evt.title}</strong>
        <span class="event-type">${evt.type}</span>
      </div>
      <span>Due: ${due}</span>
      ${evt.description ? `<span>${evt.description}</span>` : ''}
    `;

    if (canManageDirectory()) {
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '8px';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'ghost-btn';
      editBtn.addEventListener('click', () => startEditEvent(evt));

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Remove';
      delBtn.className = 'danger-btn';
      delBtn.addEventListener('click', () => deleteEvent(evt.id));

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      card.appendChild(actions);
    }

    box.appendChild(card);
  });
}

async function deleteEvent(id) {
  try {
    await deleteRequest(`${EVENTS_ENDPOINT}/${id}`);
    await loadEvents();
  } catch (err) {
    console.error(err);
    alert('Failed to delete event.');
  }
}

/* ============================================================
   STAFF + TEAMS RENDERING
   ============================================================ */
function renderStaffList(type, staff = []) {
  const config = STAFF_SECTIONS[type];
  const box = document.getElementById(config.listId);
  if (!box) return;

  box.innerHTML = '';

  if (!staff.length) {
    box.innerHTML = `<p class="empty-copy">Nothing to show yet.</p>`;
    return;
  }

  staff.forEach(person => {
    const row = document.createElement('div');
    row.className = 'staff-row';

    row.innerHTML = `
      <img class="staff-avatar" src="${resolveStaffPicture(person.staff_picture)}" />
      <div class="staff-row-text">
        <strong>${person.staff_name || 'Unnamed'}</strong>
        ${person.pronoun ? `<span>Pronouns: ${person.pronoun}</span>` : ''}
        ${person.email ? `<span>Email: ${person.email}</span>` : ''}
        ${person.contact ? `<span>Contact: ${person.contact}</span>` : ''}
        ${person.availability ? `<span>Availability: ${person.availability}</span>` : ''}
      </div>
    `;

    box.appendChild(row);
  });
}

function renderTeams(teams = []) {
  const box = document.getElementById('teamsList');
  if (!box) return;

  box.innerHTML = '';

  if (!teams.length) {
    box.innerHTML = `<p class="empty-copy">No teams registered.</p>`;
    return;
  }

  teams.forEach(team => {
    const row = document.createElement('div');
    row.className = 'team-row';

    row.innerHTML = `
      <strong>Team ${team.team_id || '--'}</strong>
      <span>${team.team_name || ''}</span>
    `;

    box.appendChild(row);
  });
}

/* ============================================================
   UTILITIES
   ============================================================ */
function updateCourseInfo(course) {
  const code = course?.course_code || 'N/A';
  const term = course?.term_year || 'N/A';
  const desc =
    course?.description ||
    'Use this space to summarize key goals or guidelines.';

  document.getElementById('courseCode').textContent = code;
  document.getElementById('courseTerm').textContent = term;
  document.getElementById('summaryTerm').textContent = term;
  document.getElementById('summaryTitle').textContent = `${code} · Directory`;
  document.getElementById('courseDescription').textContent = desc;
}

function updateSummaryStats(entry) {
  const count =
    (entry.instructors?.length || 0) +
    (entry.TAs?.length || 0) +
    (entry.tutors?.length || 0);

  const el = document.getElementById('summaryStaffCount');
  if (el) el.textContent = count;
}

function toLocalInputValue(dateString) {
  const d = new Date(dateString);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function resolveStaffPicture(path = '') {
  if (!path) return DEFAULT_AVATAR;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/assets')) return path;
  if (path.startsWith('assets')) return `/${path}`;

  return path
    .replace(/^app\/frontend\/assets/, '/assets')
    .replace(/^frontend\/assets/, '/assets');
}
