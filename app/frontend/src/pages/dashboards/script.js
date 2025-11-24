const evaluationCache = new Map();

const statusToMood = (status = '') => {
  if (/risk|off track/i.test(status)) return '😟';
  if (/progress|needs support/i.test(status)) return '🙂';
  return '😊';
};

const fetchEvaluationData = async (memberId) => {
  if (!memberId) {
    throw new Error('Missing member ID for evaluation');
  }

  if (evaluationCache.has(memberId)) {
    return evaluationCache.get(memberId);
  }

  const response = await fetch(`/api/evaluations/${memberId}`);
  if (!response.ok) {
    throw new Error('Failed to load evaluation data');
  }

  const data = await response.json();
  evaluationCache.set(memberId, data);
  return data;
};

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
  const moodFace = panel.querySelector('[data-mood-face]');
  const moodStatus = panel.querySelector('[data-mood-status]');
  const moodMeta = panel.querySelector('[data-mood-meta]');
  const notesTarget = panel.querySelector('[data-eval-notes]');

  let currentReports = [];
  let currentMemberId = null;

  const renderEmptyState = (message) => {
    if (moodFace) moodFace.textContent = '😐';
    if (moodStatus) moodStatus.textContent = 'Unavailable';
    if (moodMeta) moodMeta.textContent = '';
    if (notesTarget) notesTarget.textContent = message;
    if (weekFilter) weekFilter.innerHTML = '';
  };

  const applyReport = (report) => {
    if (!report) {
      renderEmptyState('No evaluation data for this week.');
      return;
    }
    if (moodFace) moodFace.textContent = report.mood || statusToMood(report.status);
    if (moodStatus) moodStatus.textContent = report.status || 'On Track';
    if (moodMeta) {
      const meta = report.updatedAt ? `Updated ${report.updatedAt}` : report.weekLabel ? `Captured for ${report.weekLabel}` : '';
      moodMeta.textContent = meta;
    }
    if (notesTarget) notesTarget.textContent = report.notes || 'No notes recorded for this week.';
  };

  const populateWeeks = (reports = []) => {
    if (!weekFilter) return;
    weekFilter.innerHTML = '';
    currentReports = reports;

    if (!reports.length) {
      renderEmptyState('No evaluation notes yet for this member.');
      return;
    }

    reports.forEach((report, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = report.weekLabel || report.label || `Week ${index + 1}`;
      if (index === 0) option.selected = true;
      weekFilter.appendChild(option);
    });

    applyReport(reports[0]);
  };

  const loadAndRender = async (memberId) => {
    try {
      const evaluation = await fetchEvaluationData(memberId);
      const displayName = [evaluation.memberName, evaluation.teamName].filter(Boolean).join(' · ');
      if (contextTitle) {
        contextTitle.textContent = displayName || 'Team Member';
      }
      populateWeeks(evaluation.reports || []);
    } catch (error) {
      console.error('Weekly evaluation error:', error);
      renderEmptyState('Unable to load evaluation for this member right now.');
      if (contextTitle) {
        contextTitle.textContent = 'Team Member';
      }
    }
  };

  const openPanel = (trigger) => {
    currentMemberId = trigger?.dataset?.memberId;
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    trigger?.setAttribute('aria-expanded', 'true');
    renderEmptyState('Loading evaluation…');
    loadAndRender(currentMemberId);
  };

  const closePanel = () => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    triggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  };

  weekFilter?.addEventListener('change', (event) => {
    const index = parseInt(event.target.value, 10);
    if (!Number.isNaN(index)) {
      applyReport(currentReports[index]);
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
