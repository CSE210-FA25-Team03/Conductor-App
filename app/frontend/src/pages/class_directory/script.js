/* global FullCalendar */
const DIRECTORY_ENDPOINT = '/api/class_directory';
// const INSTRUCTOR_ENDPOINT = '/api/class-directory/instructors';
// const TA_ENDPOINT = '/api/class-directory/tas';
// const TUTOR_ENDPOINT = '/api/class-directory/tutors';
const TEAMS_ENDPOINT = '/api/class-directory/teams';
const EVENTS_ENDPOINT = '/api/class-directory/events';

const DEFAULT_AVATAR = '/assets/logo/user.png';

const STAFF_SECTIONS = {
  instructor: {
    listId: 'instructorsList'
  },
  ta: {
    listId: 'tasList'
  },
  tutor: {
    listId: 'tutorsList'
  }
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
  if (canManageDirectory()) {
  
  // Read-only page → load data only
  } else {
    disableManagementUI();
  }
  loadClassDirectory();
  loadEvents();
});

function canManageDirectory() {
  const role = getUserRole();
  return role === 'professor' || role === 'teaching assistant';
}

function disableManagementUI() {
  const adminBlocks = [
    '#instructorForm',
    '#taForm',
    '#tutorForm',
    '#team-form',
    '#event-form',
    '[data-open-form]',
    '#addGoogleCalBtn'
  ];
  adminBlocks.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.style.display = 'none';
    });
  });
}

function getUserRole() {
  return (localStorage.getItem('role') || '').trim().toLowerCase();
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
  const backBtn = document.getElementById('back-btn');
  if (!backBtn) return;

  backBtn.addEventListener('click', () => {
    window.location.href = getDashboardUrl();
  });
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
      const dueInput = document.getElementById('eventDueDate');
      if (dueInput) dueInput.value = toLocalInputValue(info.dateStr);
    },
    eventClick(info) {
      const due = new Date(info.event.start).toLocaleString();
      const details = info.event.extendedProps?.description;
      const message = `Deadline: ${info.event.title}\nDue: ${due}${details ? `\n\nDetails: ${details}` : ''}\n\nDelete this event?`;

      if (confirm(message)) deleteEvent(info.event.id);
    }
  });

  calendarInstance.render();
}

/* ============================================================
   TEAM FORM (ADD TEAM)
   ============================================================ */
function bindTeamForm() {
  const form = document.getElementById('team-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

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
    } catch (error) {
      console.error('Failed to save team', error);
      alert('Failed to add team.');
    }
  });
}

/* ============================================================
   EVENT FORM (ADD EVENT)
   ============================================================ */
function bindEventForm() {
  const form = document.getElementById('event-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const rawDate = getInputValue('eventDueDate');
    const payload = {
      title: getInputValue('eventTitle'),
      description: document.getElementById('eventDescription')?.value.trim() || '',
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
    } catch (error) {
      console.error('Failed to save event', error);
      alert('Failed to save event.');
    }
  });
}

function resetEventForm(form) {
  editingEventId = null;
  form.reset();
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save Event';
}

function startEditEvent(evt) {
  const form = document.getElementById('event-form');
  if (!form) return;
  editingEventId = evt.id;
  document.getElementById('eventTitle').value = evt.title || '';
  document.getElementById('eventDescription').value = evt.description || '';
  document.getElementById('eventDueDate').value = evt.dueDate ? new Date(evt.dueDate).toISOString().slice(0, 16) : '';
  const typeSelect = document.getElementById('eventType');
  if (typeSelect) typeSelect.value = evt.type || 'Other';
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Event';
}

function resetEventForm(form) {
  editingEventId = null;
  form.reset();
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save Event';
}

function startEditEvent(evt) {
  const form = document.getElementById('event-form');
  if (!form) return;
  editingEventId = evt.id;
  document.getElementById('eventTitle').value = evt.title || '';
  document.getElementById('eventDescription').value = evt.description || '';
  document.getElementById('eventDueDate').value = evt.dueDate ? new Date(evt.dueDate).toISOString().slice(0, 16) : '';
  const typeSelect = document.getElementById('eventType');
  if (typeSelect) typeSelect.value = evt.type || 'Other';
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Event';
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

    updateCourseInfo(entry.course);
    renderStaffList('instructor', entry.instructors);
    renderStaffList('ta', entry.TAs);
    renderStaffList('tutor', entry.tutors);
    renderTeams(entry.Teams);
    updateSummaryStats(entry);
  } catch (e) {
    console.error('loadClassDirectory error', e);
  }
}

async function loadEvents() {
  try {
    const res = await fetch(EVENTS_ENDPOINT);
    const data = await res.json();

    cachedEvents = normalizeEvents(data);
    renderEventsList();
    syncCalendarEvents();
  } catch (e) {
    console.error('loadEvents error', e);
  }
}

function normalizeEvents(events = []) {
  return (events || []).map((evt) => ({
    ...evt,
    type: evt.type || 'Other'
  }));
}

function normalizeEvents(events = []) {
  return (events || []).map((evt) => ({
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

  cachedEvents.forEach(evt =>
    calendarInstance.addEvent({
      id: evt.id,
      title: evt.title,
      start: evt.dueDate,
      end: evt.dueDate,
      allDay: false,
      extendedProps: { description: evt.description || '',
        type: evt.type || 'Other' },
      color: eventColor(evt.type),
      textColor: '#0b132b'
    })
  );
}

function eventColor(type = '') {
  const normalized = type.toLowerCase();
  if (normalized === 'lecture') return '#9fe3ff';
  if (normalized === 'lab') return '#ffe89f';
  if (normalized === 'discussion') return '#d8d1ff';
  if (normalized === 'assignment') return '#c7f4d1';
  if (normalized === 'exam') return '#ffc9c9';
  return '#e0e7ff';
}

function renderEventsList() {
  const container = document.getElementById('eventsList');
  if (!container) return;

  container.innerHTML = '';

  if (!cachedEvents.length) {
    container.innerHTML = `<p class="empty-copy">No deadlines yet.</p>`;
    return;
  }

  const sorted = [...cachedEvents].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  sorted.forEach((evt) => {
    const card = document.createElement('div');
    card.className = 'event-card';

    const due = new Date(evt.dueDate).toLocaleString();

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <strong>${evt.title}</strong>
        <span class="event-type">${evt.type || 'Other'}</span>
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

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Remove';
      deleteBtn.className = 'danger-btn';
      deleteBtn.addEventListener('click', () => deleteEvent(evt.id));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      card.appendChild(actions);
    }
    container.appendChild(card);
  });
}

async function deleteEvent(id) {
  try {
    await deleteRequest(`${EVENTS_ENDPOINT}/${id}`);
    await loadEvents();
  } catch (err) {
    console.error('Delete failed', err);
    alert('Failed to delete event.');
  }
}

/* ============================================================
   STAFF + TEAMS RENDERING
   ============================================================ */
function renderStaffList(type, staff = []) {
  const config = STAFF_SECTIONS[type];
  const container = document.getElementById(config.listId);
  if (!container) return;

  container.innerHTML = '';

  if (!staff.length) {
    container.innerHTML = `<p class="empty-copy">Nothing to show yet.</p>`;
    return;
  }

  staff.forEach((person) => {
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

    container.appendChild(row);
  });
}

function renderTeams(teams = []) {
  const container = document.getElementById('teamsList');
  if (!container) return;

  container.innerHTML = '';

  if (!teams.length) {
    container.innerHTML = `<p class="empty-copy">No teams registered.</p>`;
    return;
  }

  teams.forEach(team => {
    const row = document.createElement('div');
    row.className = 'team-row';

    row.innerHTML = `
      <strong>Team ${team.team_id || '--'}</strong>
      <span>${team.team_name || ''}</span>
    `;

    container.appendChild(row);
  });
}

/* ============================================================
   UTILITIES
   ============================================================ */
function updateCourseInfo(course) {
  const code = course?.course_code || 'N/A';
  const term = course?.term_year || 'N/A';
  const desc = course?.description || 'Use this space to summarize key goals or guidelines.';

  document.getElementById('courseCode').textContent = code;
  document.getElementById('courseTerm').textContent = term;
  document.getElementById('summaryTerm').textContent = term;
  document.getElementById('summaryTitle').textContent = `${code} · Directory`;
  document.getElementById('courseDescription').textContent = desc;
}

function updateSummaryStats(entry) {
  const count = (entry.instructors?.length || 0) +
                (entry.TAs?.length || 0) +
                (entry.tutors?.length || 0);

  document.getElementById('summaryStaffCount').textContent = count;
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
