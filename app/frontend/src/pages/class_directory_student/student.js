const DIRECTORY_ENDPOINT = '/api/class_directory';
const EVENTS_ENDPOINT = '/api/class-directory/events';
const DEFAULT_AVATAR = '/assets/logo/user.png';

let calendarInstance = null;
let cachedEvents = [];

document.addEventListener('DOMContentLoaded', () => {
  wireNavigation();
  wireGoogleButton();
  initCalendar();
  loadClassDirectory();
  loadEvents();
});

function wireNavigation() {
  const backBtn = document.getElementById('backBtn');
  if (!backBtn) return;
  backBtn.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/dashboards';
    }
  });
}

function wireGoogleButton() {
  const googleBtn = document.getElementById('addGoogleCalBtn');
  if (!googleBtn) return;
  googleBtn.addEventListener('click', () => {
    alert('Use your Canvas calendar export or contact staff to add this feed.');
  });
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
      alert(`Deadline: ${info.event.title}\nDue: ${due}${details ? `\n\nDetails: ${details}` : ''}`);
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
  try {
    const response = await fetch(EVENTS_ENDPOINT);
    if (!response.ok) throw new Error('Unable to retrieve events');
    cachedEvents = await response.json();
    renderEventsList();
    syncCalendarEvents();
  } catch (error) {
    console.error('Failed to load events', error);
  }
}

function syncCalendarEvents() {
  if (!calendarInstance) return;
  calendarInstance.removeAllEvents();
  cachedEvents.forEach((evt) => {
    calendarInstance.addEvent({
      id: evt.id,
      title: evt.title,
      start: evt.dueDate,
      end: evt.dueDate,
      allDay: false,
      extendedProps: {
        description: evt.description || ''
      }
    });
  });
}

function renderEventsList() {
  const container = document.getElementById('eventsList');
  if (!container) return;
  container.innerHTML = '';

  if (!cachedEvents.length) {
    container.innerHTML = '<p class="empty-copy">No deadlines posted yet.</p>';
    return;
  }

  const sorted = [...cachedEvents].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  sorted.forEach((evt) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    const due = new Date(evt.dueDate).toLocaleString();

    card.innerHTML = `
      <strong>${evt.title}</strong>
      <span>Due: ${due}</span>
      ${evt.description ? `<span>${evt.description}</span>` : ''}
    `;

    container.appendChild(card);
  });
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

    const name = person.staff_name || 'Unnamed';
    const pronoun = person.pronoun ? `Pronouns: ${person.pronoun}` : '';
    const contactInfo = person.email || person.contact;
    const contact = contactInfo ? `Contact: ${contactInfo}` : '';
    const availability = person.availability ? `Availability: ${person.availability}` : '';
    const pictureSrc = resolveStaffPicture(person.staff_picture);

    row.innerHTML = `
      <img class="staff-avatar" src="${pictureSrc}" alt="${name}">
      <div class="staff-row-text">
        <strong>${name}</strong>
        ${pronoun ? `<span>${pronoun}</span>` : ''}
        ${contact ? `<span>${contact}</span>` : ''}
        ${availability ? `<span>${availability}</span>` : ''}
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
