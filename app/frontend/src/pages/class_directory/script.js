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
      showEventPopup({
        title: evt.title,
        due,
        desc,
      });
    }
  });

  calendarInstance.render();
}

// Lightweight popup card for event details
function ensureEventPopup() {
  let popup = document.getElementById('event-detail-popup');
  if (popup) return popup;

  // Backdrop overlay
  let backdrop = document.getElementById('event-detail-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'event-detail-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(0, 0, 0, 0.35)';
    backdrop.style.zIndex = '999';
    backdrop.style.display = 'none';
    backdrop.addEventListener('click', () => hideEventPopup());
    document.body.appendChild(backdrop);
  }

  popup = document.createElement('div');
  popup.id = 'event-detail-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.maxWidth = '480px';
  popup.style.width = 'calc(100% - 32px)';
  popup.style.background = '#ffffff';
  popup.style.border = '1px solid #e5e7eb';
  popup.style.borderRadius = '8px';
  popup.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
  popup.style.padding = '16px';
  popup.style.zIndex = '1000';
  popup.style.display = 'none';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'ghost-btn';
  closeBtn.style.float = 'right';
  closeBtn.addEventListener('click', () => hideEventPopup());

  const content = document.createElement('pre');
  content.id = 'event-detail-content';
  content.style.whiteSpace = 'pre-wrap';
  content.style.margin = '0';
  content.style.fontFamily = 'inherit';

  popup.appendChild(closeBtn);
  popup.appendChild(content);
  document.body.appendChild(popup);
  return popup;
}

function showEventPopup({ title, due, desc }) {
  const popup = ensureEventPopup();
  const content = document.getElementById('event-detail-content');
  content.textContent = `Deadline: ${title}\nDue: ${due}` + (desc ? `\n\nDetails: ${desc}` : '');
  const backdrop = document.getElementById('event-detail-backdrop');
  if (backdrop) backdrop.style.display = 'block';
  popup.style.display = 'block';
}

function hideEventPopup() {
  const popup = document.getElementById('event-detail-popup');
  if (popup) popup.style.display = 'none';
  const backdrop = document.getElementById('event-detail-backdrop');
  if (backdrop) backdrop.style.display = 'none';
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
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  // Some DELETE endpoints return 204 No Content
  if (res.status === 204) return true;
  // Fallback: try to parse JSON if present
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  return true;
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
    showToast('Event deleted', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to delete event', 'error');
  }
}

// Simple toast utility
function ensureToast() {
  let t = document.getElementById('cd-toast');
  if (t) return t;
  t = document.createElement('div');
  t.id = 'cd-toast';
  t.style.position = 'fixed';
  t.style.left = '50%';
  t.style.top = '24px';
  t.style.transform = 'translateX(-50%)';
  t.style.maxWidth = '520px';
  t.style.width = 'calc(100% - 32px)';
  t.style.padding = '12px 16px';
  t.style.borderRadius = '8px';
  t.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
  t.style.fontWeight = '500';
  t.style.zIndex = '1000';
  t.style.display = 'none';
  document.body.appendChild(t);
  return t;
}

function showToast(message, type = 'info') {
  const t = ensureToast();
  t.textContent = message;
  const isError = type === 'error';
  const isSuccess = type === 'success';
  t.style.background = isError ? '#fee2e2' : isSuccess ? '#dcfce7' : '#f3f4f6';
  t.style.color = isError ? '#991b1b' : isSuccess ? '#065f46' : '#111827';
  t.style.border = isError ? '1px solid #fca5a5' : isSuccess ? '1px solid #86efac' : '1px solid #e5e7eb';
  t.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    t.style.display = 'none';
  }, 2500);
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
    const avatar = resolveStaffPicture(person.photo_url || person.staff_picture);
    const name = person.name || person.staff_name || 'Unnamed';
    const pronouns = person.pronouns || '';
    const email = person.email || '';
    const phone = person.phone || person.contact || '';
    const availability = person.office_hours || person.availability || '';
    const publicLink = person.public_link || '';

    row.innerHTML = `
      <img class="staff-avatar" src="${avatar}" />
      <div class="staff-row-text">
        <strong>${name}</strong>
        ${pronouns ? `<span>Pronouns: ${pronouns}</span>` : ''}
        ${email ? `<span>Email: ${email}</span>` : ''}
        ${phone ? `<span>Phone: ${phone}</span>` : ''}
        ${availability ? `<span>Availability: ${availability}</span>` : ''}
        ${publicLink ? `<span>Link: <a href="${publicLink}" target="_blank" rel="noopener">${publicLink}</a></span>` : ''}
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

    const code = team.teamNumber || team.displayNumber || team.code || team.team_id || '--';
    const name = team.name || team.team_name || '';
    const status = team.status ? ` · ${team.status}` : '';

    row.innerHTML = `
      <strong>Team ${code}</strong>
      <span>${name}${status}</span>
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
