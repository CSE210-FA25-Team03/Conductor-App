// const evaluationCache = new Map();

// const statusToMood = (status = '') => {
//   if (/risk|off track/i.test(status)) return '😟';
//   if (/progress|needs support/i.test(status)) return '🙂';
//   return '😊';
// };

// const fetchEvaluationData = async (memberId) => {
//   if (!memberId) {
//     throw new Error('Missing member ID for evaluation');
//   }

//   if (evaluationCache.has(memberId)) {
//     return evaluationCache.get(memberId);
//   }

//   const response = await fetch(`/api/evaluations/${memberId}`);
//   if (!response.ok) {
//     throw new Error('Failed to load evaluation data');
//   }

//   const data = await response.json();
//   evaluationCache.set(memberId, data);
//   return data;
// };

const setupProfilePanel = () => {
  const panel = document.querySelector('.profile-panel');
  if (!panel) return;
  const closeButton = panel.querySelector('.close-profile');
  const triggers = document.querySelectorAll('.profile-trigger');

  const openPanel = (trigger) => {
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }
  };

  const closePanel = () => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    triggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openPanel(trigger);
    });
  });

  closeButton?.addEventListener('click', closePanel);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) {
      closePanel();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePanel();
    }
  });
};

const setupEvaluationPanel = () => {
  const panel = document.querySelector('.evaluation-panel');
  if (!panel) return;
  const closeBtn = panel.querySelector('.close-evaluation');
  const contextTitle = panel.querySelector('[data-eval-context]');
  const triggers = document.querySelectorAll('.evaluation-trigger');
  const weekFilter = panel.querySelector('[data-week-filter]');
  const notesTarget = panel.querySelector('[data-eval-notes]');

  // let currentReports = [];
  let currentMemberId = null;

  const renderEmptyState = () => {
    if (notesTarget) notesTarget.innerHTML = '';
    if (weekFilter) weekFilter.innerHTML = '';
  };

  function renderNotesGrid(notes) {
    if (!notesTarget) return;
    notesTarget.innerHTML = '';
    if (!Array.isArray(notes) || notes.length === 0) {
      return; // empty per new design
    }
    notes.forEach((n) => {
      const grid = document.createElement('div');
      grid.className = 'eval-note-grid';
      const independence = parseInt(n.independence_score ?? n.independenceScore ?? 0, 10) || 0;
      const technical = parseInt(n.technical_score ?? n.technicalScore ?? 0, 10) || 0;
      const teamwork = parseInt(n.teamwork_score ?? n.teamworkScore ?? 0, 10) || 0;
      const total = independence + technical + teamwork;
      const status = total <= 5 ? 'Off Track' : total <= 10 ? 'Normal' : 'On Track';
      const icon = status === 'On Track' ? '😀' : status === 'Normal' ? '😐' : '☹';
      const publicText = n.public_text ?? n.publicText ?? n.body ?? '';
      grid.innerHTML = `
        <div class="eval-note-header">${icon} ${status}</div>
        <div class="eval-note-body">${String(publicText)}</div>
      `;
      notesTarget.appendChild(grid);
    });
  }

  const populateWeeks = () => {
    if (!weekFilter) return;
    weekFilter.innerHTML = '';
    // Add blank placeholder so dropdown opens empty
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '';
    weekFilter.appendChild(blank);
    for (let w = 1; w <= 10; w += 1) {
      const option = document.createElement('option');
      option.value = String(w);
      option.textContent = `Week ${w}`;
      weekFilter.appendChild(option);
    }
    renderNotesGrid([]);
  };

  const loadAndRender = async () => {
    try {
      // Title from local context only; keep panel minimal until week selection
      if (contextTitle) {
        const name = (localStorage.getItem('firstName') && localStorage.getItem('lastName'))
          ? `${localStorage.getItem('firstName')} ${localStorage.getItem('lastName')}`
          : (localStorage.getItem('email') || 'Team Member');
        const teamName = localStorage.getItem('activeTeamName') || '';
        const displayName = [name, teamName].filter(Boolean).join(' · ');
        contextTitle.textContent = displayName || 'Team Member';
      }
      populateWeeks();
    } catch (error) {
      console.error('Weekly evaluation error:', error);
      renderEmptyState();
      if (contextTitle) {
        contextTitle.textContent = 'Team Member';
      }
    }
  };

  const openPanel = (trigger) => {
    // Determine the effective member identifier. Backend expects UUID or email.
    // Existing markup uses a numeric placeholder (e.g. "1"), which causes 400 errors.
    // If we detect a purely numeric id, fallback to the logged-in user's email from localStorage.
    const rawId = trigger?.dataset?.memberId || '';
    let effectiveId = rawId;
    if (/^\d+$/.test(rawId)) {
      const storedEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
      if (storedEmail) {
        effectiveId = storedEmail;
      }
    }
    currentMemberId = effectiveId;
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    trigger?.setAttribute('aria-expanded', 'true');
    renderEmptyState();
    loadAndRender(currentMemberId);
  };

  const closePanel = () => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    triggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  };

  weekFilter?.addEventListener('change', async (event) => {
    const weekNum = parseInt(event.target.value, 10);
    if (Number.isNaN(weekNum)) return;
    const email = (localStorage.getItem('email') || '').trim().toLowerCase();
    if (!email) {
      renderNotesGrid([]);
      return;
    }
    try {
      const resp = await fetch(`/api/eval-notes?email=${encodeURIComponent(email)}&week=${weekNum}`);
      const notes = resp.ok ? await resp.json() : [];
      renderNotesGrid(notes);
    } catch (e) {
      console.error('Failed to load eval notes by week', e);
      renderNotesGrid([]);
    }
  });

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openPanel(trigger);
    });
  });

  closeBtn?.addEventListener('click', closePanel);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) {
      closePanel();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePanel();
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  setupProfilePanel();
  setupEvaluationPanel();
});
