const DIRECTORY_ENDPOINT = '/api/class_directory';
const INSTRUCTOR_ENDPOINT = '/api/class-directory/instructors';
const TA_ENDPOINT = '/api/class-directory/tas';
const TUTOR_ENDPOINT = '/api/class-directory/tutors';
const TEAMS_ENDPOINT = '/api/class-directory/teams';
const EVENTS_ENDPOINT = '/api/class-directory/events';
const DEFAULT_AVATAR = '/assets/logo/user.png';
const STAFF_SECTIONS = {
  instructor: {
    endpoint: INSTRUCTOR_ENDPOINT,
    listId: 'instructorsList',
    formId: 'instructorForm',
    idInput: 'instructorId',
    titleId: 'instructorFormTitle',
    label: 'Instructor',
    fields: {
      picture: 'instructorPicture',
      name: 'instructorName',
      pronoun: 'instructorPronoun',
      email: 'instructorEmail',
      contact: 'instructorContact',
      availability: 'instructorAvailability'
    }
  },
  ta: {
    endpoint: TA_ENDPOINT,
    listId: 'tasList',
    formId: 'taForm',
    idInput: 'taId',
    titleId: 'taFormTitle',
    label: 'Teaching Assistant',
    fields: {
      picture: 'taPicture',
      name: 'taName',
      pronoun: 'taPronoun',
      email: 'taEmail',
      contact: 'taContact',
      availability: 'taAvailability'
    }
  },
  tutor: {
    endpoint: TUTOR_ENDPOINT,
    listId: 'tutorsList',
    formId: 'tutorForm',
    idInput: 'tutorId',
    titleId: 'tutorFormTitle',
    label: 'Tutor',
    fields: {
      picture: 'tutorPicture',
      name: 'tutorName',
      pronoun: 'tutorPronoun',
      email: 'tutorEmail',
      contact: 'tutorContact',
      availability: 'tutorAvailability'
    }
  }
};

const STAFF_FIELD_MAP = {
  picture: 'staff_picture',
  name: 'staff_name',
  pronoun: 'pronoun',
  email: 'email',
  contact: 'contact',
  availability: 'availability'
};

let calendarInstance = null;
let cachedEvents = [];

document.addEventListener('DOMContentLoaded', () => {
  wireNavigation();
  wireGoogleButton();
  initCalendar();
  bindForms();
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
    alert('Google Calendar integration will be added.');
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
    selectable: true,
    events: [],
    dateClick(info) {
      const dueInput = document.getElementById('eventDueDate');
      if (dueInput) {
        dueInput.value = toLocalInputValue(info.dateStr);
        dueInput.focus();
      }
    },
    eventClick(info) {
      const due = new Date(info.event.start).toLocaleString();
      const details = info.event.extendedProps?.description;
      const message = `Deadline: ${info.event.title}\nDue: ${due}${details ? `\n\nDetails: ${details}` : ''}\n\nDelete this event?`;
      if (confirm(message)) {
        deleteEvent(info.event.id);
      }
    }
  });

  calendarInstance.render();
}

function bindForms() {
  Object.entries(STAFF_SECTIONS).forEach(([type, config]) => {
    bindStaffForm(type, config);
  });

  bindTeamForm();
  bindEventForm();
}

function bindStaffForm(type, config) {
  const form = document.getElementById(config.formId);
  if (!form) return;

  const openButton = document.querySelector(`[data-open-form="${type}"]`);
  if (openButton) {
    openButton.addEventListener('click', () => showStaffForm(type));
  }

  const cancelButton = form.querySelector(`[data-cancel-form="${type}"]`);
  if (cancelButton) {
    cancelButton.addEventListener('click', () => hideStaffForm(type));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = buildStaffPayload(config.fields);
    if (!payload.staff_name) {
      alert('Please provide a full name before submitting.');
      return;
    }

    const hiddenId = document.getElementById(config.idInput);
    const staffId = hiddenId ? hiddenId.value.trim() : '';

    try {
      if (staffId) {
        await putJson(`${config.endpoint}/${staffId}`, payload);
      } else {
        await postJson(config.endpoint, payload);
      }
      hideStaffForm(type);
      await loadClassDirectory();
    } catch (error) {
      console.error('Failed to save entry', error);
      alert('Failed to save entry. Please try again.');
    }
  });
}

function buildStaffPayload(fields) {
  return {
    staff_picture: getInputValue(fields.picture) || DEFAULT_AVATAR,
    audio_pronounciation: '',
    staff_name: getInputValue(fields.name),
    pronounciation: '',
    pronoun: getInputValue(fields.pronoun),
    contact: getInputValue(fields.contact),
    email: getInputValue(fields.email),
    availability: getInputValue(fields.availability)
  };
}

function showStaffForm(type, staff = null) {
  const config = STAFF_SECTIONS[type];
  if (!config) return;
  const form = document.getElementById(config.formId);
  if (!form) return;

  const hiddenId = document.getElementById(config.idInput);
  if (hiddenId) {
    hiddenId.value = staff?.id || '';
  }

  fillStaffForm(config.fields, staff);

  const title = document.getElementById(config.titleId);
  if (title) {
    title.textContent = staff ? `Edit ${config.label}` : `Add ${config.label}`;
  }

  form.classList.remove('hidden');
}

function hideStaffForm(type) {
  const config = STAFF_SECTIONS[type];
  if (!config) return;
  const form = document.getElementById(config.formId);
  if (!form) return;

  form.reset();
  form.classList.add('hidden');

  const hiddenId = document.getElementById(config.idInput);
  if (hiddenId) {
    hiddenId.value = '';
  }

  const title = document.getElementById(config.titleId);
  if (title) {
    title.textContent = `Add ${config.label}`;
  }
}

function fillStaffForm(fields, staff) {
  Object.entries(fields).forEach(([key, inputId]) => {
    const element = document.getElementById(inputId);
    if (!element) return;
    if (staff) {
      element.value = staff[STAFF_FIELD_MAP[key]] || '';
    } else {
      element.value = '';
    }
  });
}

function bindTeamForm() {
  const teamForm = document.getElementById('teamForm');
  if (!teamForm) return;

  teamForm.addEventListener('submit', async (event) => {
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
      teamForm.reset();
      await loadClassDirectory();
    } catch (error) {
      console.error('Failed to save team', error);
      alert('Failed to add team. Please try again.');
    }
  });
}

function bindEventForm() {
  const eventForm = document.getElementById('eventForm');
  if (!eventForm) return;

  eventForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const rawDate = getInputValue('eventDueDate');
    const payload = {
      title: getInputValue('eventTitle'),
      description: document.getElementById('eventDescription')?.value.trim() || '',
      dueDate: rawDate ? new Date(rawDate).toISOString() : ''
    };

    if (!payload.title || !payload.dueDate) {
      alert('Title and due date are required.');
      return;
    }

    try {
      await postJson(EVENTS_ENDPOINT, payload);
      eventForm.reset();
      await loadEvents();
    } catch (error) {
      console.error('Failed to save event', error);
      alert('Failed to save event. Please try again.');
    }
  });
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
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

async function loadClassDirectory() {
  try {
    const response = await fetch(DIRECTORY_ENDPOINT);
    if (!response.ok) throw new Error('Unable to retrieve class directory');

    const data = await response.json();
    const entry = Array.isArray(data) ? data[0] : data;

    if (!entry) return;

    updateCourseInfo(entry.course);
    renderStaffList('instructor', entry.instructors);
    renderStaffList('ta', entry.TAs);
    renderStaffList('tutor', entry.tutors);
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
    container.innerHTML = '<p class="empty-copy">No deadlines yet.</p>';
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

    const button = document.createElement('button');
    button.textContent = 'Remove';
    button.addEventListener('click', () => deleteEvent(evt.id));
    card.appendChild(button);
    container.appendChild(card);
  });
}

async function deleteEvent(id) {
  if (!id) return;
  try {
    await deleteRequest(`${EVENTS_ENDPOINT}/${id}`);
    await loadEvents();
  } catch (error) {
    console.error('Failed to delete event', error);
    alert('Failed to delete event. Please try again.');
  }
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
    const fallback = 'Use this space to summarize key goals, grading logistics, or collaboration guidelines for the class.';
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

function renderStaffList(type, staff = []) {
  const config = STAFF_SECTIONS[type];
  if (!config) return;
  const container = document.getElementById(config.listId);
  if (!container) return;

  container.innerHTML = '';

  if (!staff || staff.length === 0) {
    container.innerHTML = '<p class="empty-copy">Nothing to show yet.</p>';
    return;
  }

  staff.forEach((person) => {
    const row = document.createElement('div');
    row.className = 'staff-row';

    const avatar = document.createElement('img');
    avatar.className = 'staff-avatar';
    avatar.src = resolveStaffPicture(person.staff_picture);
    avatar.alt = person.staff_name || 'Staff';

    const textWrapper = document.createElement('div');
    textWrapper.className = 'staff-row-text';

    const nameEl = document.createElement('strong');
    nameEl.textContent = person.staff_name || 'Unnamed';
    textWrapper.appendChild(nameEl);

    if (person.pronoun) {
      const span = document.createElement('span');
      span.textContent = `Pronouns: ${person.pronoun}`;
      textWrapper.appendChild(span);
    }

    if (person.email) {
      const span = document.createElement('span');
      span.textContent = `Email: ${person.email}`;
      textWrapper.appendChild(span);
    }

    if (person.contact) {
      const span = document.createElement('span');
      span.textContent = `Contact: ${person.contact}`;
      textWrapper.appendChild(span);
    }

    if (person.availability) {
      const span = document.createElement('span');
      span.textContent = `Availability: ${person.availability}`;
      textWrapper.appendChild(span);
    }

    const controls = document.createElement('div');
    controls.className = 'staff-controls';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ghost-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => showStaffForm(type, person));
    controls.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteStaffMember(type, person.id));
    controls.appendChild(deleteBtn);

    row.appendChild(avatar);
    row.appendChild(textWrapper);
    row.appendChild(controls);

    container.appendChild(row);
  });
}

function renderTeams(teams = []) {
  const container = document.getElementById('teamsList');
  if (!container) return;

  container.innerHTML = '';

  if (!teams || teams.length === 0) {
    container.innerHTML = '<p class="empty-copy">No teams registered.</p>';
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

function toLocalInputValue(dateString) {
  const date = new Date(dateString);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function resolveStaffPicture(path = '') {
  if (!path) return DEFAULT_AVATAR;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/assets')) return path;
  if (path.startsWith('assets')) return `/${path}`;
  return path.replace(/^app\/frontend\/assets/, '/assets').replace(/^frontend\/assets/, '/assets');
}

async function deleteStaffMember(type, staffId) {
  if (!staffId) return;
  if (!confirm('Delete this entry? This action cannot be undone.')) return;
  const config = STAFF_SECTIONS[type];
  if (!config) return;
  try {
    await deleteRequest(`${config.endpoint}/${staffId}`);
    await loadClassDirectory();
  } catch (error) {
    console.error('Failed to delete entry', error);
    alert('Failed to delete entry. Please try again.');
  }
}
