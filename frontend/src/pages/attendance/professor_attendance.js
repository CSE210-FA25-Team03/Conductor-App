// frontend/src/pages/attendance/professor_attendance.js
// Professor-facing attendance management page.
// Uses backend endpoints:
//   GET  /api/attendance/sessions
//   POST /api/attendance/sessions
//   GET  /api/attendance/sessions/:id (for details)

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }

    return res.json();
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  function isSessionActive(session) {
    if (!session || !session.expiresAt) return false;
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    return now <= expiresAt;
  }

  function clearElement(el) {
    if (el) el.innerHTML = '';
  }

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------
  const durationInput = document.getElementById('attendanceDuration');
  const generateBtn = document.getElementById('generateAttendanceCodeBtn');
  const currentCodeDisplay = document.getElementById('currentCodeDisplay');
  const sessionsContainer = document.getElementById('attendanceSessionsContainer');
  const backDashboardLink = document.getElementById('backDashboard');
  const errorBox = document.getElementById('errorBox');

  const profileImg = document.getElementById('dashboardProfileImg');
  const profileDropdown = document.getElementById('profileDropdown');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!durationInput || !generateBtn || !currentCodeDisplay || !sessionsContainer) {
    console.warn('[professor_attendance] Required DOM elements missing; aborting init.');
    return;
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || 'An unexpected error occurred.';
    errorBox.style.display = 'block';
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // Profile dropdown + logout + back button
  // ---------------------------------------------------------------------------
  if (profileImg && profileDropdown) {
    profileImg.addEventListener('mouseenter', () => {
      profileDropdown.style.display = 'block';
    });

    profileImg.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!profileDropdown.matches(':hover')) {
          profileDropdown.style.display = 'none';
        }
      }, 150);
    });

    profileDropdown.addEventListener('mouseenter', () => {
      profileDropdown.style.display = 'block';
    });

    profileDropdown.addEventListener('mouseleave', () => {
      profileDropdown.style.display = 'none';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = '/login';
    });
  }

  if (backDashboardLink) {
    backDashboardLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Adjust path if your professor dashboard lives somewhere else
      window.location.href = '/dashboards/professor.html';
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering: current code
  // ---------------------------------------------------------------------------
  let currentSession = null;
  let currentTimerId = null;

  function renderCurrentCode(session) {
    clearElement(currentCodeDisplay);
    if (currentTimerId) {
      clearInterval(currentTimerId);
      currentTimerId = null;
    }

    if (!session) {
      currentCodeDisplay.textContent = 'No active attendance code.';
      return;
    }

    currentSession = session;

    const wrapper = document.createElement('div');
    wrapper.className = 'current-code-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0.25rem';

    const codeLine = document.createElement('div');
    codeLine.innerHTML = `
      <span style="font-size:0.9rem;color:#555;">Current code:</span>
      <span style="font-size:1.4rem;font-weight:700;margin-left:0.35rem;">${session.code}</span>
    `;

    const metaLine = document.createElement('div');
    metaLine.style.fontSize = '0.9rem';
    metaLine.style.color = '#555';

    const expiresAt = new Date(session.expiresAt);
    metaLine.textContent = `Created at ${formatDateTime(
      session.createdAt,
    )} · Expires at ${formatDateTime(expiresAt.toISOString())}`;

    const statusLine = document.createElement('div');
    statusLine.style.fontSize = '0.9rem';
    statusLine.style.fontWeight = '500';

    wrapper.appendChild(codeLine);
    wrapper.appendChild(metaLine);
    wrapper.appendChild(statusLine);

    currentCodeDisplay.appendChild(wrapper);

    function updateStatus() {
      const now = new Date();
      const remainingMs = expiresAt.getTime() - now.getTime();

      if (remainingMs <= 0) {
        statusLine.textContent = 'Status: expired';
        statusLine.style.color = '#b00020';
        if (currentTimerId) {
          clearInterval(currentTimerId);
          currentTimerId = null;
        }
        return;
      }

      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      statusLine.textContent = `Status: active · ${minutes}m ${seconds}s remaining`;
      statusLine.style.color = '#0a7a30';
    }

    updateStatus();
    currentTimerId = setInterval(updateStatus, 1000);
  }

  // ---------------------------------------------------------------------------
  // Rendering: sessions list
  // ---------------------------------------------------------------------------
  async function loadSessionDetails(sessionId, containerEl) {
    try {
      const data = await fetchJSON(`${API_BASE}/attendance/sessions/${encodeURIComponent(sessionId)}`);

      const records = Array.isArray(data.records) ? data.records : [];
      if (!records.length) {
        containerEl.innerHTML = `
          <p style="font-size:0.85rem;color:#666;margin-top:0.25rem;">
            No students have been marked present yet for this session.
          </p>
        `;
        return;
      }

      const rows = records
        .map((r) => {
          const name = r.name || '(no name)';
          const email = r.email || '';
          const when = formatDateTime(r.markedAt);
          const status = r.success ? 'Present' : 'Not Present';

          return `
            <tr>
              <td style="padding:4px 6px;border:1px solid #eee;">${name}</td>
              <td style="padding:4px 6px;border:1px solid #eee;">${email}</td>
              <td style="padding:4px 6px;border:1px solid #eee;">${when}</td>
              <td style="padding:4px 6px;border:1px solid #eee;">${status}</td>
            </tr>
          `;
        })
        .join('');

      containerEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;margin-top:0.5rem;">
          <thead>
            <tr>
              <th style="padding:4px 6px;border:1px solid #eee;text-align:left;">Student</th>
              <th style="padding:4px 6px;border:1px solid #eee;text-align:left;">Email</th>
              <th style="padding:4px 6px;border:1px solid #eee;text-align:left;">Marked At</th>
              <th style="padding:4px 6px;border:1px solid #eee;text-align:left;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error('[professor_attendance] Failed to load session details:', err);
      containerEl.innerHTML = `
        <p style="font-size:0.85rem;color:#b00020;margin-top:0.25rem;">
          Failed to load attendance details for this session.
        </p>
      `;
    }
  }

  function renderSessions(sessions) {
    clearElement(sessionsContainer);

    if (!Array.isArray(sessions) || !sessions.length) {
      sessionsContainer.innerHTML = `
        <p style="font-size:0.9rem;color:#666;">
          No attendance sessions have been created yet.
        </p>
      `;
      return;
    }

    const now = new Date();

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '0.75rem';

    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'attendance-session-item';
      item.style.border = '1px solid #eee';
      item.style.borderRadius = '6px';
      item.style.padding = '0.5rem 0.75rem';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.gap = '0.5rem';

      const left = document.createElement('div');
      const createdAt = formatDateTime(session.createdAt);
      const expiresAt = new Date(session.expiresAt);

      const active = isSessionActive(session);
      const statusLabel = active ? 'Active' : 'Expired';
      const statusColor = active ? '#0a7a30' : '#b00020';

      left.innerHTML = `
        <div style="font-size:0.9rem;">
          <span style="color:#555;">Code:</span>
          <span style="font-weight:600;margin-left:0.25rem;">${session.code}</span>
        </div>
        <div style="font-size:0.8rem;color:#666;">
          Created: ${createdAt} · Expires: ${formatDateTime(expiresAt.toISOString())}
        </div>
        <div style="font-size:0.8rem;margin-top:0.15rem;">
          <span style="color:#555;">Present:</span>
          <span style="font-weight:600;margin-left:0.25rem;">${session.presentCount}</span>
        </div>
      `;

      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.flexDirection = 'column';
      right.style.alignItems = 'flex-end';
      right.style.gap = '0.25rem';

      const statusBadge = document.createElement('span');
      statusBadge.textContent = statusLabel;
      statusBadge.style.fontSize = '0.75rem';
      statusBadge.style.fontWeight = '600';
      statusBadge.style.padding = '2px 6px';
      statusBadge.style.borderRadius = '999px';
      statusBadge.style.border = `1px solid ${statusColor}`;
      statusBadge.style.color = statusColor;
      statusBadge.style.backgroundColor = active ? '#ecfdf3' : '#fef2f2';

      const detailsBtn = document.createElement('button');
      detailsBtn.textContent = 'View details';
      detailsBtn.type = 'button';
      detailsBtn.style.fontSize = '0.8rem';
      detailsBtn.style.padding = '4px 8px';
      detailsBtn.style.borderRadius = '4px';
      detailsBtn.style.border = '1px solid #ddd';
      detailsBtn.style.background = '#f9fafb';
      detailsBtn.style.cursor = 'pointer';

      right.appendChild(statusBadge);
      right.appendChild(detailsBtn);

      header.appendChild(left);
      header.appendChild(right);

      const detailsContainer = document.createElement('div');
      detailsContainer.style.marginTop = '0.35rem';
      detailsContainer.style.display = 'none';

      item.appendChild(header);
      item.appendChild(detailsContainer);

      let isDetailsLoaded = false;
      let isOpen = false;

      detailsBtn.addEventListener('click', async () => {
        if (!isOpen) {
          detailsContainer.style.display = 'block';
          detailsBtn.textContent = 'Hide details';
          isOpen = true;

          if (!isDetailsLoaded) {
            isDetailsLoaded = true;
            detailsContainer.innerHTML = `
              <p style="font-size:0.85rem;color:#666;">
                Loading attendance records…
              </p>
            `;
            await loadSessionDetails(session.id, detailsContainer);
          }
        } else {
          detailsContainer.style.display = 'none';
          detailsBtn.textContent = 'View details';
          isOpen = false;
        }
      });

      list.appendChild(item);
    });

    sessionsContainer.appendChild(list);
  }

  // ---------------------------------------------------------------------------
  // Load sessions from backend
  // ---------------------------------------------------------------------------
  async function loadSessionsAndCurrent() {
    try {
      clearError();
      const sessions = await fetchJSON(`${API_BASE}/attendance/sessions`);

      // Choose the latest active (or latest) as current for display
      const active = (sessions || []).filter(isSessionActive);
      if (active.length) {
        // Most recent active by createdAt
        const current = active.slice().sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];
        renderCurrentCode(current);
      } else if (sessions && sessions.length) {
        // No active, show most recent session
        const current = sessions.slice().sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];
        renderCurrentCode(current);
      } else {
        renderCurrentCode(null);
      }

      renderSessions(sessions || []);
    } catch (err) {
      console.error('[professor_attendance] Failed to load sessions:', err);
      showError('Failed to load attendance sessions. Please refresh the page.');
    }
  }

  // ---------------------------------------------------------------------------
  // Generate new session
  // ---------------------------------------------------------------------------
  async function handleGenerateCode() {
    try {
      clearError();

      let durationMinutes = parseInt(durationInput.value, 10);
      if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
        durationMinutes = 10;
      } else if (durationMinutes > 60) {
        durationMinutes = 60;
      }

      durationInput.value = String(durationMinutes);

      const payload = { durationMinutes };

      const session = await fetchJSON(`${API_BASE}/attendance/sessions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      renderCurrentCode(session);
      await loadSessionsAndCurrent();
    } catch (err) {
      console.error('[professor_attendance] Failed to create session:', err);
      showError('Failed to create attendance session. Please check DB config and try again.');
    }
  }

  generateBtn.addEventListener('click', handleGenerateCode);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------
  loadSessionsAndCurrent();
});
