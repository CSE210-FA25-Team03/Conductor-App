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
  if (role === 'tutor') return '/dashboards/tutor.html';
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
      const evt = info.event;
      const due = new Date(evt.start).toLocaleString();
      const desc = evt.extendedProps?.description || '';
      const type = evt.extendedProps?.type || '';
      showEventPopup({
        title: evt.title + (type ? ` \u2013 ${type}` : ''),
        due,
        desc
      });
    }
  });

  calendarInstance.render();
}

// Lightweight popup card for event details (student view)
function ensureEventPopup() {
  let popup = document.getElementById('event-detail-popup');
  if (popup) return popup;

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
    showToast('Event deleted', 'success');
  } catch (error) {
    console.error('Failed to delete event', error);
    showToast('Failed to delete event', 'error');
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
    const message = await response.text().catch(() => '');
    throw new Error(message || `HTTP ${response.status}`);
  }
  if (response.status === 204) return true;
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return response.json();
  }
  return true;
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

// Simple toast utility (top-center)
function ensureToast() {
  let t = document.getElementById('cd-toast');
  if (t) return t;
  t = document.createElement('div');
  t.id = 'cd-toast';
  t.style.position = 'fixed';
  t.style.left = '50%';
  t.style.top = '24px';
  t.style.transform = 'translateX(-50%)';
  // t.style.maxWidth = '520px';
  // t.style.width = 'calc(100% - 32px)';
  t.style.padding = '12px 16px';
  t.style.borderRadius = '8px';
  t.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
  t.style.fontWeight = '500';
  t.style.zIndex = '1000';
  // t.style.display = 'none';


  t.style.display = 'flex';
  t.style.flexDirection = 'column';
  t.style.alignItems = 'center'; 
  t.style.maxWidth = '100%'; 
  document.body.appendChild(t);
  return t;
}

function showToast(message, type = 'info') {
  const t = ensureToast();
  t.textContent = message;
  const isError = type === 'error';
  const isSuccess = type === 'success';
  t.style.background = isError
    ? '#fee2e2'
    : isSuccess
    ? '#dcfce7'
    : '#f3f4f6';
  t.style.color = isError ? '#991b1b' : isSuccess ? '#065f46' : '#111827';
  t.style.border = isError
    ? '1px solid #fca5a5'
    : isSuccess
    ? '1px solid #86efac'
    : '1px solid #e5e7eb';
  t.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    t.style.display = 'none';
  }, 2500);
}
