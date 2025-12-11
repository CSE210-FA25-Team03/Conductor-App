const PEOPLE_DIRECTORY_ENDPOINT = '/api/class_directory';
const MEMBERS_ENDPOINT = '/api/members';
const DEFAULT_AVATAR = '/assets/logo/user.png';

let peopleData = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  wireNavigation();
  wireFilters();
  loadPeople();
});

function getDashboardUrl() {
  const role = (localStorage.getItem('role') || '').toLowerCase();
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

function wireFilters() {
  document.querySelectorAll('.pill[data-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.role;
      document.querySelectorAll('.pill[data-role]').forEach((node) => node.classList.remove('active'));
      btn.classList.add('active');
      renderPeople();
    });
  });

  const roleSelect = document.getElementById('roleSelect');
  if (roleSelect) {
    roleSelect.addEventListener('change', () => {
      activeFilter = roleSelect.value || 'all';
      renderPeople();
    });
  }

  const searchInput = document.getElementById('peopleSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderPeople();
    });
  }
}

async function loadPeople() {
  try {
    const [directoryRes, membersRes] = await Promise.all([fetch(PEOPLE_DIRECTORY_ENDPOINT), fetch(MEMBERS_ENDPOINT)]);
    if (!directoryRes.ok) throw new Error('Failed to load class directory');
    if (!membersRes.ok) throw new Error('Failed to load members');

    const directoryData = await directoryRes.json();
    const entry = Array.isArray(directoryData) ? directoryData[0] : directoryData;
    const members = await membersRes.json();

    updateCourseInfo(entry?.course);
    peopleData = buildPeopleData(entry, members);
    renderPeople();
  } catch (error) {
    console.error('Unable to load people view', error);
  }
}

function buildPeopleData(entry, members = []) {
  const courseCode = entry?.course?.course_code || '';
  const term = entry?.course?.term_year || '';
  const sectionLabel = [courseCode, term].filter(Boolean).join(' • ');
  const normalizeName = (name) => name?.trim() || 'Unnamed';

  // Build a quick lookup for staff extra data (avatar/pronouns) by id
  const staffArrays = [entry?.instructors || [], entry?.TAs || [], entry?.tutors || []];
  const staffMap = {};
  staffArrays.forEach((arr) => {
    arr.forEach((person) => {
      const id = person.id || person.user_id || null;
      if (!id) return;
      staffMap[id] = {
        avatar: resolvePicture(person.photo_url || person.staff_picture || ''),
        pronouns: person.pronouns || person.pronoun || ''
      };
    });
  });

  // Use role from members; map professor->instructor label for UI consistency
  const people = (members || []).map((member) => {
    const rawRole = (member.role || 'student').toLowerCase();
    let mappedRole = rawRole; // preserve raw role first
    if (rawRole === 'professor') mappedRole = 'instructor';
    // keep team_lead as-is so it can be labeled distinctly
    if (!['instructor','ta','tutor','team_lead','student'].includes(mappedRole)) {
      mappedRole = 'student';
    }

    const staffInfo = staffMap[member.id] || {};
    return {
      name: normalizeName(member.name),
      role: mappedRole,
      section: sectionLabel || 'Main',
      initials: member.initials || '',
      avatar: staffInfo.avatar || DEFAULT_AVATAR,
      pronoun: staffInfo.pronouns || ''
    };
  });

  // Sort by name
  return people.sort((a, b) => a.name.localeCompare(b.name));
}

function renderPeople() {
  const container = document.getElementById('peopleTable');
  if (!container) return;

  const searchTerm = document.getElementById('peopleSearch')?.value.toLowerCase().trim() || '';
  const filtered = peopleData.filter((person) => {
    const matchesRole = activeFilter === 'all' || person.role === activeFilter;
    const matchesSearch = !searchTerm || person.name.toLowerCase().includes(searchTerm);
    return matchesRole && matchesSearch;
  });

  if (!filtered.length) {
    container.innerHTML = '<div class="people-row"><strong>No people found.</strong></div>';
    return;
  }

  container.innerHTML = '';
  filtered.forEach((person) => {
    const row = document.createElement('div');
    row.className = 'people-row';
    const initials = person.initials || getInitials(person.name);
    const roleLabel = roleToLabel(person.role);

    row.innerHTML = `
      <div class="person">
        <img class="avatar" src="${person.avatar}" alt="${person.name}" onerror="this.src='${DEFAULT_AVATAR}'" />
        <div class="person-name">
          <strong>${person.name}</strong>
          ${person.pronoun ? `<span>${person.pronoun}</span>` : ''}
        </div>
      </div>
      <div>${person.section}</div>
      <div><span class="badge">${roleLabel}</span></div>
    `;

    // Swap to initials badge if avatar is default image
    row.querySelector('img').addEventListener('error', () => {
      const badge = document.createElement('div');
      badge.className = 'avatar';
      badge.textContent = initials;
      row.querySelector('.person').replaceChild(badge, row.querySelector('img'));
    });

    container.appendChild(row);
  });
}

function roleToLabel(role) {
  switch (role) {
    case 'instructor':
      return 'Instructor';
    case 'ta':
      return 'TA';
    case 'tutor':
      return 'Tutor';
    case 'team_lead':
      return 'Team Lead';
    case 'student':
    default:
      return 'Student';
  }
}

function getInitials(name) {
  const parts = name.split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function resolvePicture(path = '') {
  if (!path) return DEFAULT_AVATAR;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/assets')) return path;
  if (path.startsWith('assets')) return `/${path}`;
  return path.replace(/^app\/frontend\/assets/, '/assets').replace(/^frontend\/assets/, '/assets');
}

function updateCourseInfo(course) {
  const codeEl = document.getElementById('courseCode');
  const termEl = document.getElementById('courseTerm');
  const titleEl = document.getElementById('pageTitle');
  const summaryTitle = document.getElementById('summaryTitle');

  const courseCode = course?.course_code || 'N/A';
  const courseTerm = course?.term_year || 'N/A';

  if (codeEl) codeEl.textContent = courseCode;
  if (termEl) termEl.textContent = courseTerm;
  if (titleEl) titleEl.textContent = `${courseCode} · People`;
  if (summaryTitle) summaryTitle.textContent = `${courseCode} · People`;
}
