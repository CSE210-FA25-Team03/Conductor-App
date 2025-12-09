// student_team_card/script.js
(function() {
  const grid = document.getElementById('teamsGrid');
  const modal = document.getElementById('teamModal');
  const closeBtn = document.querySelector('.team-modal-close');
  const backBtn = document.getElementById('backDashboard');

  const modalName = document.getElementById('modalTeamName');
  const modalStatus = document.getElementById('modalTeamStatus');
  const modalDesc = document.getElementById('modalDescription');
  const modalStatusDesc = document.getElementById('modalStatusDesc');
  const modalTA = document.getElementById('modalTA');
  const modalRepo = document.getElementById('modalRepoLink');
  const modalMembers = document.getElementById('modalMembers');

  function getCurrentUser() {
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser'));
      if (stored && stored.email) return stored;
    } catch{
      return { email: 'student@school.edu', role: 'student' };
    }
  }
  const currentUser = getCurrentUser();

  function teamCardHtml(team) {
    return `
      <div class="team-card">
        <header>
          <div>
            <small>${team.displayNumber || team.code}</small>
            <h3>${team.name}</h3>
          </div>
        </header>
        <p>${team.description || 'No description.'}</p>
        <button data-team-id="${team.id}" class="info-btn">Card info</button>
      </div>
    `;
  }

  async function loadMyTeams() {
    if (!grid) return;
    grid.innerHTML = '<p style="color:#555;">Loading teams...</p>';
    try {
      const res = await fetch(`/api/my-teams?email=${encodeURIComponent(currentUser.email)}`);
      if (!res.ok) throw new Error('Failed to load teams');
      const teams = await res.json();
      if (!Array.isArray(teams) || !teams.length) {
        grid.innerHTML = '<p style="color:#777;">You are not currently in any teams.</p>';
        return;
      }
      grid.innerHTML = teams.map(teamCardHtml).join('');
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p style="color:#b00020;">Failed to load teams.</p>';
    }
  }

  async function openTeamModal(teamId) {
    try {
      const res = await fetch(`/api/team-card/${teamId}`);
      if (!res.ok) throw new Error('Failed to load team details');
      const data = await res.json();
      modalName.textContent = data.name || 'Unnamed Team';
      modalStatus.textContent = data.status || 'N/A';
      modalDesc.textContent = data.description || 'No description available.';
      modalStatusDesc.textContent = data.statusDescription || 'No status details.';
      modalTA.textContent = data.ta ? `${data.ta.name} (${data.ta.email})` : 'None assigned';
      if (modalRepo) {
        if (data.repoUrl) {
          const safe = data.repoUrl.trim();
          modalRepo.innerHTML = `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
        } else {
          modalRepo.textContent = 'Repo not set.';
        }
      }
      modalMembers.innerHTML = (data.members || []).map(m => `
        <li class="member-item">
          <span class="member-name">${m.name} <small style="color:#555;">${m.email || ''}</small>
            ${m.isLeader ? '<span class="leader-badge">👑 Leader</span>' : ''}
          </span>
        </li>
      `).join('') || '<li style="color:#777;">No members.</li>';
      modal.style.display = 'flex';

      enableEditableFields(teamId, data);
    } catch (err) {
      console.error(err);
      alert('Unable to load team details.');
    }
  }

  function isCurrentUserLeader(data) {
    const email = (currentUser.email || '').toLowerCase();
    return (data.members || []).some(m => m.isLeader && (m.email || '').toLowerCase() === email);
  }

  function enableEditableFields(teamId, data) {
    const primaryRole = (localStorage.getItem('primaryRole') || currentUser.role || '').toLowerCase();
    const leader = isCurrentUserLeader(data);
    if (!(primaryRole === 'team_lead' && leader) && primaryRole !== 'professor' && primaryRole !== 'ta') {
      return; // Not authorized for inline editing
    }

    // Add edit buttons if not already added
    if (!document.getElementById('editDescBtn')) {
      const btn = document.createElement('button');
      btn.id = 'editDescBtn';
      btn.className = 'card-btn';
      btn.style.marginTop = '6px';
      btn.textContent = 'Edit Description';
      modalDesc.parentElement.appendChild(btn);
      btn.addEventListener('click', () => makeEditableField(teamId, 'description', modalDesc, data.description || ''));
    }
    if (!document.getElementById('editStatusDescBtn')) {
      const btn2 = document.createElement('button');
      btn2.id = 'editStatusDescBtn';
      btn2.className = 'card-btn';
      btn2.style.marginTop = '6px';
      btn2.textContent = 'Edit Status Details';
      modalStatusDesc.parentElement.appendChild(btn2);
      btn2.addEventListener('click', () => makeEditableField(teamId, 'statusDescription', modalStatusDesc, data.statusDescription || ''));
    }
    if (modalRepo && !document.getElementById('editRepoLinkBtn')) {
      const btn3 = document.createElement('button');
      btn3.id = 'editRepoLinkBtn';
      btn3.className = 'card-btn';
      btn3.style.marginTop = '6px';
      btn3.textContent = 'Edit Repo Link';
      modalRepo.parentElement.appendChild(btn3);
      btn3.addEventListener('click', () => makeEditableField(teamId, 'repoUrl', modalRepo, data.repoUrl || ''));
    }
  }

  function makeEditableField(teamId, fieldKey, node, initialValue) {
    // Prevent multiple editors
    if (node.dataset.editing === 'true') return;
    node.dataset.editing = 'true';

    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '8px';
    const isRepo = fieldKey === 'repoUrl';
    const inputEl = isRepo ? document.createElement('input') : document.createElement('textarea');
    if (isRepo) {
      inputEl.type = 'url';
      inputEl.placeholder = 'https://github.com/org/repo';
      inputEl.style.width = '100%';
      inputEl.style.padding = '8px';
      inputEl.style.border = '1px solid #ccc';
      inputEl.style.borderRadius = '6px';
      inputEl.value = initialValue;
    } else {
      inputEl.value = initialValue;
      inputEl.style.width = '100%';
      inputEl.style.minHeight = '80px';
      inputEl.style.fontFamily = 'inherit';
      inputEl.style.fontSize = '14px';
      inputEl.style.padding = '8px';
      inputEl.style.border = '1px solid #ccc';
      inputEl.style.borderRadius = '6px';
    }

    const actions = document.createElement('div');
    actions.style.marginTop = '6px';
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'card-btn';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'card-btn';

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    wrapper.appendChild(inputEl);
    wrapper.appendChild(actions);

    // Hide original text
    node.style.display = 'none';
    node.parentElement.appendChild(wrapper);

    cancelBtn.addEventListener('click', () => {
      wrapper.remove();
      node.style.display = '';
      node.dataset.editing = 'false';
    });

    saveBtn.addEventListener('click', async () => {
      const newValue = inputEl.value.trim();
      try {
        const payload = { email: currentUser.email };
        payload[fieldKey] = newValue;
        const resp = await fetch(`/api/team-card/${teamId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('Failed to save');
        const json = await resp.json();

        // Normalize response shape from server: some endpoints return the team object directly
        const updatedTeam = (json && json.team) ? json.team : json;

        const updatedDescription = (updatedTeam && (updatedTeam.description ?? null)) ?? newValue;
        const updatedStatusDesc = (updatedTeam && (updatedTeam.statusDescription ?? null)) ?? newValue;
        const updatedRepo = (updatedTeam && (updatedTeam.repoUrl ?? null)) ?? newValue;

        if (fieldKey === 'description') {
          node.textContent = updatedDescription || 'No description available.';
          // Also update the grid card preview so the change is visible immediately
          const btnInGrid = document.querySelector(`.info-btn[data-team-id="${teamId}"]`);
          if (btnInGrid) {
            const card = btnInGrid.closest('.team-card');
            const descP = card ? card.querySelector('p') : null;
            if (descP) descP.textContent = updatedDescription || 'No description.';
          }
        } else if (fieldKey === 'statusDescription') {
          node.textContent = updatedStatusDesc || 'No status details.';
        } else if (fieldKey === 'repoUrl') {
          const repo = updatedRepo || '';
          node.innerHTML = repo
            ? `<a href="${repo}" target="_blank" rel="noopener noreferrer">${repo}</a>`
            : 'Repo not set.';
        }
        wrapper.remove();
        node.style.display = '';
        node.dataset.editing = 'false';
      } catch (err) {
        console.error(err);
        alert('Failed to save changes.');
      }
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-btn');
    if (btn && btn.dataset.teamId) {
      openTeamModal(btn.dataset.teamId);
    }
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') modal.style.display = 'none'; });
  }

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const role = (currentUser.role || '').toLowerCase();
      if (role === 'team_lead') {
        window.location.href = '/dashboards/team_lead.html';
      } else if (role === 'professor') {
        window.location.href = '/dashboards/professor.html';
      } else if (role === 'ta') {
        window.location.href = '/dashboards/ta.html';
      } else if (role === 'tutor') {
        window.location.href = '/dashboards/tutor.html';
      } else {
        window.location.href = '/dashboards/student.html';
      }
    });
  }

  // Sync profile image
  const savedImg = localStorage.getItem('profileImg');
  if (savedImg) {
    const img = document.getElementById('profileImg');
    if (img) img.src = savedImg;
  }

  // Profile dropdown logic
  const profileImg = document.getElementById('dashboardProfileImg');
  const dropdown = document.getElementById('profileDropdown');
  if (profileImg && dropdown) {
    profileImg.addEventListener('mouseenter', () => {
      dropdown.style.display = 'block';
    });
    profileImg.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!dropdown.matches(':hover')) dropdown.style.display = 'none';
      }, 150);
    });
    dropdown.addEventListener('mouseleave', () => {
      dropdown.style.display = 'none';
    });
    dropdown.addEventListener('mouseenter', () => {
      dropdown.style.display = 'block';
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '/login';
      });
    }
  }

  // Saved profile image for dashboard avatar
  const savedDashboardImg = localStorage.getItem('profileImg');
  if (savedDashboardImg && profileImg) {
    profileImg.src = savedDashboardImg;
  }

  loadMyTeams();
})();
