const DIRECTORY_ENDPOINT = '/api/class_directory';
const INSTRUCTOR_ENDPOINT = '/api/class-directory/instructors';
const TA_ENDPOINT = '/api/class-directory/tas';
const TUTOR_ENDPOINT = '/api/class-directory/tutors';

document.addEventListener('DOMContentLoaded', () => {
  wireNavigation();
  bindForms();
  loadClassDirectory();

  const googleBtn = document.getElementById('addGoogleCalBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      alert('Google Calendar integration will be added.');
    });
  }
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

function bindForms() {
  const instructorForm = document.getElementById('instructorForm');
  if (instructorForm) {
    instructorForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitStaffForm({
        endpoint: INSTRUCTOR_ENDPOINT,
        payload: {
          staff_picture: 'app/frontend/assets/logo/user.png',
          audio_pronounciation: '',
          staff_name: getInputValue('instructorName'),
          pronounciation: '',
          pronoun: getInputValue('instructorPronoun'),
          contact: combineContact(getInputValue('instructorEmail'), getInputValue('instructorContact')),
          email: getInputValue('instructorEmail'),
          availability: getInputValue('instructorAvailability')
        },
        form: instructorForm
      });
    });
  }

  const taForm = document.getElementById('taForm');
  if (taForm) {
    taForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitStaffForm({
        endpoint: TA_ENDPOINT,
        payload: {
          staff_picture: 'app/frontend/assets/logo/user.png',
          audio_pronounciation: '',
          staff_name: getInputValue('taName'),
          pronounciation: '',
          pronoun: getInputValue('taPronoun'),
          contact: combineContact(getInputValue('taEmail'), getInputValue('taContact')),
          email: getInputValue('taEmail'),
          availability: getInputValue('taAvailability')
        },
        form: taForm
      });
    });
  }

  const tutorForm = document.getElementById('tutorForm');
  if (tutorForm) {
    tutorForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitStaffForm({
        endpoint: TUTOR_ENDPOINT,
        payload: {
          staff_picture: 'app/frontend/assets/logo/user.png',
          audio_pronounciation: '',
          staff_name: getInputValue('tutorName'),
          pronounciation: '',
          pronoun: getInputValue('tutorPronoun'),
          contact: combineContact(getInputValue('tutorEmail'), getInputValue('tutorContact')),
          email: getInputValue('tutorEmail'),
          availability: getInputValue('tutorAvailability')
        },
        form: tutorForm
      });
    });
  }
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function combineContact(email, contact) {
  if (email && contact) return `${email} | ${contact}`;
  return email || contact || '';
}

async function submitStaffForm({ endpoint, payload, form }) {
  if (!payload.staff_name) {
    alert('Please provide a full name before submitting.');
    return;
  }

  try {
    await postJson(endpoint, payload);
    form.reset();
    await loadClassDirectory();
  } catch (error) {
    console.error('Failed to save entry', error);
    alert('Failed to save entry. Please try again.');
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
  } catch (error) {
    console.error('Failed to load class directory', error);
  }
}

function updateCourseInfo(course) {
  const codeEl = document.getElementById('courseCode');
  const termEl = document.getElementById('courseTerm');

  if (codeEl) {
    codeEl.textContent = course?.course_code || 'N/A';
  }
  if (termEl) {
    termEl.textContent = course?.term_year || 'N/A';
  }
}

function renderStaffList(containerId, staff = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (!staff || staff.length === 0) {
    container.innerHTML = '<p class="empty-copy">Nothing to show yet.</p>';
    return;
  }

  staff.forEach((person) => {
    const row = document.createElement('div');
    row.className = 'staff-row';

    const name = person.staff_name || 'Unnamed';
    const pronoun = person.pronoun ? `Pronouns: ${person.pronoun}` : '';
    const contact = person.email || person.contact ? `Contact: ${person.email || person.contact}` : '';
    const availability = person.availability ? `Availability: ${person.availability}` : '';

    row.innerHTML = `
      <strong>${name}</strong>
      ${pronoun ? `<span>${pronoun}</span>` : ''}
      ${contact ? `<span>${contact}</span>` : ''}
      ${availability ? `<span>${availability}</span>` : ''}
    `;

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
      <div>
        <label>Team Number</label>
        <input type="text" value="${team.team_id || ''}" readonly>
      </div>
      <div>
        <label>Team Name</label>
        <input type="text" value="${team.team_name || ''}" readonly>
      </div>
    `;
    container.appendChild(row);
  });
}
