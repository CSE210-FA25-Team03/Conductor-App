/* =======================================================
   GROUP FORMATION JS (DB-BACKED)
   - Loads skills & ratings from backend APIs
   - Loads/saves persistent groups (teams, members, TAs)
======================================================= */

const API_BASE = '/api';

/* =============================
   Dummy Data (fallback only)
============================= */

const FALLBACK_STUDENTS = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@school.edu',
    ratings: { Java: 2, JavaScript: 3, HTML: 1 },
  },
  {
    id: 2,
    name: 'Bob Lee',
    email: 'bob@school.edu',
    ratings: { Java: 3, JavaScript: 1, HTML: 2 },
  },
  {
    id: 3,
    name: 'Charlie Kim',
    email: 'charlie@school.edu',
    ratings: { Java: 1, JavaScript: 4, HTML: 3 },
  },
];

const FALLBACK_TAS = ['Sam Taylor', 'Diana Chen'];

/* =============================
   Global State
============================= */

let skills = [];           // [{ id, name, weight, ... }]
let studentRatings = [];   // [{ id, name, email, ratings: {skill:level} }]
let taMembers = [];        // [{ id, name, email }]
let currentGroups = [];    // [{ id?, teamName?, taUserId?, members: [{ userId, name, email, role }] }]
let isLoading = false;

/* =============================
   DOM References
============================= */

const skillsTableBody = document.querySelector('#skillsTable tbody');
const studentsTableBody = document.querySelector('#studentsTable tbody');
const taTableBody = document.querySelector('#taTable tbody');
const groupsTableBody = document.getElementById('groupsTableBody');

const addSkillBtn = document.getElementById('addSkillBtn');
const saveSkillsBtn = document.getElementById('saveSkillsBtn');
const generateBtn = document.getElementById('generateBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const saveGroupsBtn = document.getElementById('saveGroupsBtn');
const groupSizeInput = document.getElementById('groupSize');

/* =============================
   Utility Helpers
============================= */

function showError(msg) {
  const box = document.getElementById('errorBox');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  box.classList.add('show');
  setTimeout(() => {
    box.classList.remove('show');
    box.classList.add('hidden');
  }, 3000);
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

/* =============================
   SKILLS – Load & Render
============================= */

async function refreshSkillsFromServer() {
  try {
    const data = await fetchJSON(`${API_BASE}/group-formation/skills`);
    skills = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to load skills from server:', err);
    if (!skills.length) {
      showError('Could not load skills from server. Using empty list.');
    }
  }
}

function renderSkillsTable() {
  skillsTableBody.innerHTML = '';

  if (!skills.length) {
    skillsTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#777;">
          No skills defined yet.
        </td>
      </tr>
    `;
    return;
  }

  skills.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${s.name}</td>
      <td>${s.weight}</td>
      <td>
        <button class="delete-btn" data-id="${s.id || ''}">
          Delete
        </button>
      </td>
    `;
    skillsTableBody.appendChild(tr);
  });

  // Attach delete listeners
  skillsTableBody.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const skillId = e.currentTarget.dataset.id;
      if (!skillId) {
        showError('Cannot delete this skill (missing ID).');
        return;
      }

      if (!confirm('Are you sure you want to delete this skill?')) return;

      try {
        await fetchJSON(`${API_BASE}/group-formation/skills/${skillId}`, {
          method: 'DELETE',
        });
        skills = skills.filter((s) => String(s.id) !== String(skillId));
        renderSkillsTable();
      } catch (err) {
        console.error('Failed to delete skill:', err);
        showError('Failed to delete skill. Please try again.');
      }
    });
  });
}

/* =============================
   STUDENTS – Load & Render
============================= */

async function refreshStudentRatingsFromServer() {
  try {
    const data = await fetchJSON(`${API_BASE}/group-formation/student-ratings`);
    studentRatings = (Array.isArray(data) ? data : []).map((row, idx) => ({
      id: row.user_id || row.id || idx + 1,
      name: row.name || 'Unknown Student',
      email: row.email || '',
      ratings: row.ratings || {},
    }));
  } catch (err) {
    console.error('Failed to load student ratings from server:', err);
    if (!studentRatings.length) {
      showError('Could not load student ratings. Using fallback data.');
      studentRatings = FALLBACK_STUDENTS.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        ratings: s.ratings || {},
      }));
    }
  }
}

function renderStudentsTable() {
  studentsTableBody.innerHTML = '';

  if (!studentRatings.length) {
    studentsTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#777;">
          No students found in roster.
        </td>
      </tr>
    `;
    return;
  }

  studentRatings.forEach((s, idx) => {
    const ratingStr = Object.entries(s.ratings || {})
      .map(([skill, level]) => `${skill}: ${level}`)
      .join(', ');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${s.name}</td>
      <td>${s.email}</td>
      <td>${ratingStr || 'Default ratings (2) or none'}</td>
    `;
    studentsTableBody.appendChild(tr);
  });
}

/* =============================
   TAs – Load & Render
============================= */

async function refreshTAsFromServer() {
  try {
    const members = await fetchJSON(`${API_BASE}/members`);
    taMembers = (Array.isArray(members) ? members : [])
      .filter((m) => {
        const role = (m.role || '').toLowerCase();
        return role === 'ta' || role === 'teaching assistant';
      })
      .map((m, idx) => ({
        id: m.id || idx + 1,
        name: m.name || 'Unknown TA',
        email: m.email || `${(m.name || 'ta')
          .toLowerCase()
          .replace(/\s+/g, '.')}@school.edu`,
      }));

    if (!taMembers.length) {
      taMembers = FALLBACK_TAS.map((name, idx) => ({
        id: `fallback-${idx + 1}`,
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@school.edu`,
      }));
      showError('No TAs found in roster; using fallback list.');
    }
  } catch (err) {
    console.error('Failed to load TAs from server:', err);
    if (!taMembers.length) {
      taMembers = FALLBACK_TAS.map((name, idx) => ({
        id: `fallback-${idx + 1}`,
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@school.edu`,
      }));
      showError('Could not load TAs. Using fallback list.');
    }
  }
}

function renderTAsTable() {
  taTableBody.innerHTML = '';

  if (!taMembers.length) {
    taTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center;color:#777;">
          No TAs available.
        </td>
      </tr>
    `;
    return;
  }

  taMembers.forEach((ta, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${ta.name}</td>
      <td>${ta.email}</td>
    `;
    taTableBody.appendChild(tr);
  });
}

/* =============================
   Add / Save Skill Handlers
============================= */

async function handleAddSkillClick() {
  const nameInput = document.getElementById('skillName');
  const weightInput = document.getElementById('skillWeight');

  const name = (nameInput.value || '').trim();
  const weight = Number(weightInput.value);

  if (!name) {
    showError('Please enter a skill name.');
    return;
  }
  if (!weight || weight < 1 || weight > 10) {
    showError('Skill weight must be between 1 and 10.');
    return;
  }

  try {
    const created = await fetchJSON(`${API_BASE}/group-formation/skills`, {
      method: 'POST',
      body: JSON.stringify({ name, weight }),
    });

    skills.push(created);
    renderSkillsTable();

    nameInput.value = '';
    weightInput.value = 5;
  } catch (err) {
    console.error('Failed to add skill:', err);
    showError('Failed to add skill. Please try again.');
  }
}

function handleSaveSkillsClick() {
  alert('Skills are already saved to the database as you add/delete them.');
}

/* =============================
   Groups – Load Existing From Server
============================= */

async function refreshExistingGroupsFromServer() {
  try {
    const data = await fetchJSON(`${API_BASE}/group-formation/groups`);
    currentGroups = Array.isArray(data) ? data : [];

    // If there are saved groups, show them
    if (currentGroups.length) {
      renderGroupsTable(currentGroups);
    } else {
      renderGroupsTable([]); // clears table to "No groups yet."
    }
  } catch (err) {
    console.error('Failed to load existing groups:', err);
    // We don't block the page; professor can still generate new groups.
    renderGroupsTable([]);
  }
}

/* =============================
   Helpers for Group Generation
============================= */

function getStudentsForGrouping() {
  const source =
    studentRatings && studentRatings.length
      ? studentRatings
      : FALLBACK_STUDENTS.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          ratings: s.ratings || {},
        }));

  return source.map((s) => ({
    ...s,
    skills: Object.keys(s.ratings || {}),
  }));
}

function getTaEmailsForGrouping() {
  if (taMembers && taMembers.length) {
    return taMembers.map((t) => t.email);
  }
  return FALLBACK_TAS.map(
    (ta) => `${ta.toLowerCase().replace(/\s+/g, '.')}@school.edu`,
  );
}

function getRequiredSkillsForGrouping() {
  return skills && skills.length ? skills : [];
}

/* =============================
   Groups Table Renderer (Editable)
============================= */

function renderGroupsTable(groups) {
  groupsTableBody.innerHTML = '';

  if (!groups || !groups.length) {
    groupsTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#777;">
          No groups yet. Use Smart/Random generate to form teams.
        </td>
      </tr>
    `;
    return;
  }

  // Normalize groups (assign local indices & names if missing)
  currentGroups = groups.map((g, idx) => ({
    id: g.id || `team-${idx + 1}`,
    teamName: g.teamName || g.name || `Team ${idx + 1}`,
    taUserId: g.taUserId || null,
    members: Array.isArray(g.members) ? g.members : [],
  }));

  // Build a flat list of rows
  const localGroups = currentGroups;
  const teamOptionsHtml = (selectedTeamId) =>
    localGroups
      .map((g, idx) => {
        const id = g.id || `team-${idx + 1}`;
        const label = g.teamName || `Team ${idx + 1}`;
        const selected =
          String(id) === String(selectedTeamId) ? 'selected' : '';
        return `<option value="${id}" ${selected}>${label}</option>`;
      })
      .join('');

  const taOptionsHtml = (selectedTaUserId) => {
    const base = ['<option value="">None</option>'];
    base.push(
      ...taMembers.map((ta) => {
        const selected =
          selectedTaUserId && String(ta.id) === String(selectedTaUserId)
            ? 'selected'
            : '';
        return `<option value="${ta.id}" ${selected}>${ta.name}</option>`;
      }),
    );
    return base.join('');
  };

  localGroups.forEach((group, groupIdx) => {
    const teamId = group.id || `team-${groupIdx + 1}`;
    const selectedTa = group.taUserId || '';

    (group.members || []).forEach((m) => {
      const role = (m.role || 'member').toLowerCase();

      const tr = document.createElement('tr');
      tr.dataset.userId = m.userId || m.id || '';
      tr.dataset.defaultTeamId = teamId;

      tr.innerHTML = `
        <td>${m.name || ''}</td>
        <td>${m.email || ''}</td>
        <td>${m.pid || ''}</td>
        <td>
          <select class="team-select">
            ${teamOptionsHtml(teamId)}
          </select>
        </td>
        <td>
          <select class="role-select">
            <option value="member" ${role === 'member' ? 'selected' : ''}>
              Member
            </option>
            <option value="team_lead" ${
              role === 'team_lead' ? 'selected' : ''
            }>
              Team Lead
            </option>
          </select>
        </td>
        <td>
          <select class="ta-select">
            ${taOptionsHtml(selectedTa)}
          </select>
        </td>
      `;

      groupsTableBody.appendChild(tr);
    });
  });
}

/* =============================
   Smart Group Generation
============================= */

function smartGenerateGroups() {
  const size = Number(groupSizeInput.value);
  if (!size || size <= 0) {
    alert('Enter a valid group size.');
    return;
  }

  if (!window.GroupAlgo || typeof window.GroupAlgo.formGroups !== 'function') {
    showError('Grouping algorithm not loaded.');
    return;
  }

  const allStudents = getStudentsForGrouping();
  const requiredSkills = getRequiredSkillsForGrouping();
  const tasList = getTaEmailsForGrouping();

  // Helper to map algorithm student back to real id/email
  const byEmail = new Map(
    allStudents.map((s) => [(s.email || '').toLowerCase(), s]),
  );

  const algoGroups =
    window.GroupAlgo.formGroups(allStudents, size, requiredSkills) || [];

  const tableGroups = algoGroups.map((g, idx) => {
    const teamId = g.id || `team-${idx + 1}`;
    const members = (g.students || []).map((s) => {
      const key = (s.email || '').toLowerCase();
      const base = byEmail.get(key) || {};
      return {
        userId: base.id,
        name: s.name || base.name,
        email: s.email || base.email,
        pid: s.pid || '',
        role: s.role || 'member',
      };
    });

    // We won't assign TA here; professor can pick later.
    return {
      id: teamId,
      teamName: `Team ${idx + 1}`,
      taUserId: null,
      members,
    };
  });

  currentGroups = tableGroups;
  renderGroupsTable(tableGroups);
}

/* =============================
   Random Group Generation
============================= */

function randomGenerateGroups() {
  const size = Number(groupSizeInput.value);
  if (!size || size <= 0) {
    alert('Enter a valid group size.');
    return;
  }

  if (
    !window.GroupAlgo ||
    typeof window.GroupAlgo.formGroupsRandom !== 'function'
  ) {
    showError('Random grouping algorithm not loaded.');
    return;
  }

  const allStudents = getStudentsForGrouping();
  const algoGroups = window.GroupAlgo.formGroupsRandom(allStudents, size) || [];

  const byEmail = new Map(
    allStudents.map((s) => [(s.email || '').toLowerCase(), s]),
  );

  const tableGroups = algoGroups.map((g, idx) => {
    const teamId = g.id || `team-${idx + 1}`;
    const members = (g.students || []).map((s) => {
      const key = (s.email || '').toLowerCase();
      const base = byEmail.get(key) || {};
      return {
        userId: base.id,
        name: s.name || base.name,
        email: s.email || base.email,
        pid: s.pid || '',
        role: s.role || 'member',
      };
    });

    return {
      id: teamId,
      teamName: `Team ${idx + 1}`,
      taUserId: null,
      members,
    };
  });

  currentGroups = tableGroups;
  renderGroupsTable(tableGroups);
}

/* =============================
   Save Groups – build payload from table
============================= */

function collectGroupsFromTable() {
  const rows = Array.from(groupsTableBody.querySelectorAll('tr[data-user-id]'));
  if (!rows.length) return [];

  const groupsById = new Map();

  rows.forEach((row) => {
    const userId = row.dataset.userId;
    if (!userId) return;

    const name = (row.cells[0]?.textContent || '').trim();
    const email = (row.cells[1]?.textContent || '').trim();

    const teamSelect = row.querySelector('.team-select');
    const roleSelect = row.querySelector('.role-select');
    const taSelect = row.querySelector('.ta-select');

    const teamId = teamSelect ? teamSelect.value : row.dataset.defaultTeamId;
    const role = roleSelect ? roleSelect.value : 'member';
    const taUserId = taSelect ? taSelect.value || null : null;

    if (!teamId) return;

    if (!groupsById.has(teamId)) {
      groupsById.set(teamId, {
        teamId,
        teamName: `Team ${groupsById.size + 1}`,
        taUserId: taUserId,
        members: [],
      });
    }

    const group = groupsById.get(teamId);
    group.members.push({ userId, name, email, role });

    if (!group.taUserId && taUserId) {
      group.taUserId = taUserId;
    }
  });

  return Array.from(groupsById.values()).map((g, idx) => ({
    teamName: g.teamName || `Team ${idx + 1}`,
    taUserId: g.taUserId || null,
    members: g.members,
  }));
}

async function handleSaveGroupsClick() {
  const payloadGroups = collectGroupsFromTable();
  if (!payloadGroups.length) {
    alert('No groups to save. Please generate or edit groups first.');
    return;
  }

  try {
    const res = await fetchJSON(`${API_BASE}/group-formation/groups`, {
      method: 'POST',
      body: JSON.stringify({ groups: payloadGroups }),
    });

    if (res && Array.isArray(res.groups)) {
      currentGroups = res.groups;
      renderGroupsTable(currentGroups);
      alert('Groups saved successfully.');
    } else {
      alert('Groups saved, but server returned an unexpected response.');
    }
  } catch (err) {
    console.error('Failed to save groups:', err);
    showError('Failed to save groups. Please try again.');
  }
}

/* =============================
   Initial Page Load
============================= */

async function initGroupFormationPage() {
  if (isLoading) return;
  isLoading = true;

  try {
    await Promise.all([
      refreshSkillsFromServer(),
      refreshStudentRatingsFromServer(),
      refreshTAsFromServer(),
    ]);

    renderSkillsTable();
    renderStudentsTable();
    renderTAsTable();

    // Load any previously saved groups
    await refreshExistingGroupsFromServer();
  } catch (err) {
    console.error('Error during group formation init:', err);
    showError('Failed to load some group-formation data.');
  } finally {
    isLoading = false;
  }
}

/* =============================
   Event Listeners
============================= */

if (addSkillBtn) {
  addSkillBtn.addEventListener('click', handleAddSkillClick);
}
if (saveSkillsBtn) {
  saveSkillsBtn.addEventListener('click', handleSaveSkillsClick);
}
if (generateBtn) {
  generateBtn.addEventListener('click', smartGenerateGroups);
}
if (randomizeBtn) {
  randomizeBtn.addEventListener('click', randomGenerateGroups);
}
if (saveGroupsBtn) {
  saveGroupsBtn.addEventListener('click', handleSaveGroupsClick);
}

window.addEventListener('DOMContentLoaded', () => {
  initGroupFormationPage();
});
