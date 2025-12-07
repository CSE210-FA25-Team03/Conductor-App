/* global FullCalendar */
const DIRECTORY_ENDPOINT = '/api/class_directory';
const EVENTS_ENDPOINT = '/api/class-directory/events';
const DEFAULT_AVATAR = '/assets/logo/user.png';

let calendarInstance = null;
let cachedEvents = [];
let activeEventType = 'all';
let editingEventId = null;

document.addEventListener('DOMContentLoaded', () => {
  wireNavigation();
  wireGoogleButton();
  wireManageStaffButton();
  initCalendar();
  loadClassDirectory();
  loadEvents();
  wireEventFilter();
  if (canManageEvents()) {
    bindEventForm();
  } else {
    hideEventForm();
  }
});

function getDashboardUrl() {
  const role = getUserRole();
  if (role === 'professor') return '/dashboards/professor.html';
  if (role === 'ta') return '/dashboards/ta.html';
  if (role === 'team_lead') return '/dashboards/team_lead.html';
  return '/dashboards/student.html';
}

function wireNavigation() {
  const backBtn = document.getElementById('backBtn');
  if (!backBtn) return;
  backBtn.addEventListener('click', () => {
    window.location.href = getDashboardUrl();
  });
}

function wireManageStaffButton() {
  const manageBtn = document.getElementById('manageStaffBtn');
  if (!manageBtn) return;
  if (canManageEvents()) {
    manageBtn.style.display = 'inline-flex';
    manageBtn.addEventListener('click', () => {
      window.location.href = '/class_directory/class_directory.html';
    });
  } else {
    manageBtn.style.display = 'none';
  }
}

function wireGoogleButton() {
  const googleBtn = document.getElementById('addGoogleCalBtn');
  if (!googleBtn) return;
  googleBtn.addEventListener('click', () => {
    alert('Use your Canvas calendar export or contact staff to add this feed.');
  });
}

function canManageEvents() {
  const role = getUserRole();
  return role === 'professor';
}

function hideEventForm() {
  const form = document.getElementById('eventForm');
  const cancelBtn = document.getElementById('cancelEventEdit');
  if (form) form.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

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
    selectable: false,
    events: [],
    eventClick(info) {
      const due = new Date(info.event.start).toLocaleString();
      const details = info.event.extendedProps?.description;
      const type = info.event.extendedProps?.type ? `Type: ${info.event.extendedProps.type}\n` : '';
      alert(`Deadline: ${info.event.title}\n${type}Due: ${due}${details ? `\n\nDetails: ${details}` : ''}`);
    }
  });

  calendarInstance.render();
}

async function loadClassDirectory() {
  try {
    const response = await fetch(DIRECTORY_ENDPOINT);
    if (!response.ok) throw new Error('Unable to retrieve class directory');

    const data = await response.json();
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry) return;

    updateCourseInfo(entry.course);
    renderStaffList('instructorsList', entry.instructors);
    renderStaffList('tasList', entry.TAs);
    renderStaffList('tutorsList', entry.tutors);
    renderTeams(entry.Teams);
    updateSummaryStats(entry);
  } catch (error) {
    console.error('Failed to load class directory', error);
  }
}

async function loadEvents() {
  const shouldLoad = document.getElementById('calendar') || document.getElementById('eventsList');
  if (!shouldLoad) return;

  try {
    const response = await fetch(EVENTS_ENDPOINT);
    if (!response.ok) throw new Error('Unable to retrieve events');
    const data = await response.json();
    cachedEvents = normalizeEvents(data);
    renderEventsList();
    syncCalendarEvents();
  } catch (error) {
    console.error('Failed to load events', error);
  }
}

function normalizeEvents(events = []) {
  return (events || []).map((evt) => ({
    ...evt,
    type: evt.type || 'Other'
  }));
}

function bindEventForm() {
  const form = document.getElementById('eventForm');
  if (!form) return;
  const cancelBtn = document.getElementById('cancelEventEdit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawDate = document.getElementById('eventDueDate')?.value;
    const payload = {
      title: document.getElementById('eventTitle')?.value.trim(),
      description: document.getElementById('eventDescription')?.value.trim() || '',
      dueDate: rawDate ? new Date(rawDate).toISOString() : '',
      type: document.getElementById('eventTypeSelect')?.value || 'Other'
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
      resetEventForm();
      await loadEvents();
    } catch (error) {
      console.error('Failed to save event', error);
      alert('Failed to save event. Please try again.');
    }
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => resetEventForm());
  }
}

function resetEventForm() {
  editingEventId = null;
  const form = document.getElementById('eventForm');
  if (form) form.reset();
  const cancelBtn = document.getElementById('cancelEventEdit');
  if (cancelBtn) cancelBtn.style.display = 'none';
  const titleEl = document.getElementById('eventFormTitle');
  if (titleEl) titleEl.textContent = 'Add Event';
  const submitBtn = document.querySelector('#eventForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save Event';
}

function startEditEvent(evt) {
  const form = document.getElementById('eventForm');
  if (!form) return;
  editingEventId = evt.id;
  document.getElementById('eventTitle').value = evt.title || '';
  document.getElementById('eventDescription').value = evt.description || '';
  document.getElementById('eventDueDate').value = evt.dueDate ? new Date(evt.dueDate).toISOString().slice(0, 16) : '';
  const typeSelect = document.getElementById('eventTypeSelect');
  if (typeSelect) typeSelect.value = evt.type || 'Other';
  const cancelBtn = document.getElementById('cancelEventEdit');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';
  const titleEl = document.getElementById('eventFormTitle');
  if (titleEl) titleEl.textContent = 'Edit Event';
  const submitBtn = document.querySelector('#eventForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Event';
}

function wireEventFilter() {
  const filter = document.getElementById('eventTypeFilter');
  if (!filter) return;
  filter.addEventListener('change', (e) => {
    activeEventType = e.target.value || 'all';
    renderEventsList();
    syncCalendarEvents();
  });
}

function syncCalendarEvents() {
  if (!calendarInstance) return;
  calendarInstance.removeAllEvents();
  const events = getFilteredEvents();
  events.forEach((evt) => {
    calendarInstance.addEvent({
      id: evt.id,
      title: evt.title,
      start: evt.dueDate,
      end: evt.dueDate,
      allDay: false,
      extendedProps: {
        description: evt.description || '',
        type: evt.type || 'Other'
      },
      color: eventColor(evt.type),
      textColor: '#0b132b'
    });
  });
}

function renderEventsList() {
  const container = document.getElementById('eventsList');
  if (!container) return;
  container.innerHTML = '';

  const events = getFilteredEvents();

  if (!events.length) {
    container.innerHTML = '<p class="empty-copy">No deadlines posted yet.</p>';
    return;
  }

  const sorted = [...events].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
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

    if (canManageEvents() && document.getElementById('eventForm')) {
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

function getFilteredEvents() {
  if (activeEventType === 'all') return cachedEvents;
  return cachedEvents.filter((evt) => (evt.type || 'Other') === activeEventType);
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

function getUserRole() {
  return (localStorage.getItem('role') || '').trim().toLowerCase();
}

async function deleteEvent(id) {
  if (!id) return;
  try {
    await deleteRequest(`${EVENTS_ENDPOINT}/${id}`);
    resetEventForm();
    await loadEvents();
  } catch (error) {
    console.error('Failed to delete event', error);
    alert('Failed to delete event. Please try again.');
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json();
}

async function putJson(url, body) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json();
}

async function deleteRequest(url) {
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json();
}

function updateCourseInfo(course) {
  const codeEl = document.getElementById('courseCode');
  const termEl = document.getElementById('courseTerm');
  const summaryTitle = document.getElementById('summaryTitle');
  const descriptionEl = document.getElementById('courseDescription');
  const summaryTerm = document.getElementById('summaryTerm');

  const courseCode = course?.course_code || 'N/A';
  const courseTerm = course?.term_year || 'N/A';

  if (codeEl) codeEl.textContent = courseCode;
  if (termEl) termEl.textContent = courseTerm;
  if (summaryTerm) summaryTerm.textContent = courseTerm;
  if (summaryTitle) summaryTitle.textContent = `${courseCode} · Directory`;
  if (descriptionEl) {
    const fallback = 'Your staff keeps this page up to date with expectations, grading logistics, and helpful reminders.';
    descriptionEl.textContent = course?.description || fallback;
  }
}

function updateSummaryStats(entry) {
  const summaryStaffCount = document.getElementById('summaryStaffCount');
  if (!summaryStaffCount) return;
  const instructors = entry.instructors?.length || 0;
  const tas = entry.TAs?.length || 0;
  const tutors = entry.tutors?.length || 0;
  summaryStaffCount.textContent = instructors + tas + tutors;
}

function renderStaffList(containerId, staff = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (!staff || staff.length === 0) {
    container.innerHTML = '<p class="empty-copy">Information coming soon.</p>';
    return;
  }

  staff.forEach((person) => {
    const row = document.createElement('div');
    row.className = 'staff-row';

    const name = person.name || person.staff_name || 'Unnamed';
    const pronouns = person.pronouns || person.pronoun || '';
    const email = person.email || '';
    const phone = person.phone || person.contact || '';
    const availability = person.office_hours || person.availability || '';
    const publicLink = person.public_link || person.link || '';
    const pictureSrc = resolveStaffPicture(person.photo_url || person.staff_picture || '');

    row.innerHTML = `
      <img class="staff-avatar" src="${pictureSrc}" alt="${name}">
      <div class="staff-row-text">
        <strong>${name}</strong>
        ${pronouns ? `<span>Pronouns: ${pronouns}</span>` : ''}
        ${email ? `<span>Email: ${email}</span>` : ''}
        ${phone ? `<span>Phone: ${phone}</span>` : ''}
        ${availability ? `<span>Availability: ${availability}</span>` : ''}
        ${publicLink ? `<span>Link: <a href="${publicLink}" target="_blank" rel="noopener">${publicLink}</a></span>` : ''}
      </div>
    `;

    container.appendChild(row);
  });
}

function renderTeams(teams = []) {
  const container = document.getElementById('teamsList');
  if (!container) return;

  container.innerHTML = '';

  if (!teams || teams.length === 0) {
    container.innerHTML = '<p class="empty-copy">Teams will appear here once assigned.</p>';
    return;
  }

  teams.forEach((team) => {
    const row = document.createElement('div');
    row.className = 'team-row';
    row.innerHTML = `
      <strong>Team ${team.team_id || '--'}</strong>
      <span>${team.team_name || ''}</span>
    `;
    container.appendChild(row);
  });
}

function resolveStaffPicture(path = '') {
  if (!path) return DEFAULT_AVATAR;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/assets')) return path;
  if (path.startsWith('assets')) return `/${path}`;
  return path.replace(/^app\/frontend\/assets/, '/assets').replace(/^frontend\/assets/, '/assets');
}
