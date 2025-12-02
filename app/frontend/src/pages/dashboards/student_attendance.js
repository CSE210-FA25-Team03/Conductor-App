// student_attendance.js
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

  function getCurrentUser() {
    const fallback = {
      email: 'student@school.edu',
      role: 'student',
      classId: 'CSE210',
    };
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser'));
      return stored || fallback;
    } catch {
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // DOM References
  // ---------------------------------------------------------------------------
  const openBtn = document.getElementById('openStudentAttendanceBtn');
  const panel = document.getElementById('studentAttendancePanel');
  if (!openBtn || !panel) return;

  const codeInput = document.getElementById('studentAttendanceCodeInput');
  const submitBtn = document.getElementById('studentAttendanceSubmitBtn');
  const statusEl = document.getElementById('studentAttendanceStatus');
  const historyContainer = document.getElementById('studentAttendanceHistory');
  const closeBtn = document.getElementById('studentAttendanceCloseBtn');

  // ---------------------------------------------------------------------------
  // Current user context
  // ---------------------------------------------------------------------------
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.classId || !currentUser.email) {
    console.warn('Student attendance: missing currentUser/classId/email.');
    return;
  }

  const email = (currentUser.email || '').toLowerCase();

  // ---------------------------------------------------------------------------
  // History rendering
  // ---------------------------------------------------------------------------
  async function loadHistory() {
    if (!historyContainer) return;

    try {
      const data = await fetchJSON(
        `${API_BASE}/attendance/history?email=${encodeURIComponent(email)}`,
      );

      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      const presentCount =
        typeof data.presentCount === 'number' ? data.presentCount : 0;
      const total =
        typeof data.totalSessions === 'number'
          ? data.totalSessions
          : sessions.length;

      if (!sessions.length) {
        historyContainer.innerHTML =
          '<p style="font-size:0.9rem;color:#777;">No attendance sessions have been created yet.</p>';
        return;
      }

      const pct = total ? Math.round((presentCount / total) * 100) : 0;

      const sorted = sessions
        .slice()
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );

      let rows = '';
      sorted.forEach((s) => {
        const when = new Date(s.createdAt).toLocaleString();
        const status =
          (s.status || '').toLowerCase() === 'present'
            ? 'Present'
            : 'Absent';

        rows += `
          <tr>
            <td style="border:1px solid #eee;padding:4px 6px;">${when}</td>
            <td style="border:1px solid #eee;padding:4px 6px;">${status}</td>
          </tr>
        `;
      });

      historyContainer.innerHTML = `
        <p style="font-size:0.9rem;">
          Overall: <strong>${presentCount}/${total}</strong> (${pct}%)
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="border:1px solid #eee;padding:4px 6px;">Session</th>
              <th style="border:1px solid #eee;padding:4px 6px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error('Failed to load attendance history:', err);
      historyContainer.innerHTML =
        '<p style="font-size:0.9rem;color:#b00020;">Failed to load attendance history.</p>';
    }
  }

  // ---------------------------------------------------------------------------
  // Panel open/close
  // ---------------------------------------------------------------------------
  function openPanel() {
    panel.style.display = 'block';
    if (codeInput) codeInput.value = '';
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.style.color = '#333';
    }
    loadHistory();
  }

  function closePanel() {
    panel.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // Submit attendance code
  // ---------------------------------------------------------------------------
  async function handleSubmit() {
    if (!codeInput || !statusEl) return;

    const raw = codeInput.value || '';
    const code = raw.trim().toUpperCase();

    if (!code) {
      statusEl.textContent = 'Please enter a code.';
      statusEl.style.color = '#b00020';
      return;
    }

    try {
      const result = await fetchJSON(`${API_BASE}/attendance/mark`, {
        method: 'POST',
        body: JSON.stringify({ code, email }),
      });

      if (result && result.success) {
        statusEl.textContent = 'You are marked present for this session.';
        statusEl.style.color = '#0a7a30';
        await loadHistory();
      } else {
        statusEl.textContent =
          (result && result.message) ||
          'Code not found or expired. Make sure you enter it during the class window.';
        statusEl.style.color = '#b00020';
      }
    } catch (err) {
      console.error('Failed to mark attendance:', err);
      statusEl.textContent =
        'Could not submit attendance. Please check the code and try again.';
      statusEl.style.color = '#b00020';
    }
  }

  // ---------------------------------------------------------------------------
  // Event listeners
  // ---------------------------------------------------------------------------
  if (openBtn) {
    openBtn.addEventListener('click', openPanel);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closePanel);
  }

  // Allow clicking on backdrop to close (if panel is a full-screen overlay)
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closePanel();
  });

  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }
});
