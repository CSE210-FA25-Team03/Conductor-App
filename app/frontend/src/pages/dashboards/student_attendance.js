document.addEventListener('DOMContentLoaded', () => {
  const {
    getCurrentUser,
    getAttendanceSessions,
    getAttendanceRecords,
    markAttendancePresent,
  } = window.ConductorStorage;

  const openBtn = document.getElementById('openStudentAttendanceBtn');
  const panel = document.getElementById('studentAttendancePanel');
  if (!openBtn || !panel) return;

  const codeInput = document.getElementById('studentAttendanceCodeInput');
  const submitBtn = document.getElementById('studentAttendanceSubmitBtn');
  const statusEl = document.getElementById('studentAttendanceStatus');
  const historyContainer = document.getElementById('studentAttendanceHistory');
  const closeBtn = document.getElementById('studentAttendanceCloseBtn');

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.classId) return;
  const classId = currentUser.classId;
  const email = (currentUser.email || '').toLowerCase();

  function renderHistory() {
    const sessions = getAttendanceSessions(classId);
    const records = getAttendanceRecords(classId);

    if (!sessions.length) {
      historyContainer.innerHTML =
        '<p style="font-size:0.9rem;color:#777;">No attendance sessions have been created yet.</p>';
      return;
    }

    const sorted = sessions
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    let presentCount = 0;
    const total = sorted.length;
    let rows = '';

    sorted.forEach((s) => {
      const rec = records[s.id] || {};
      const present = !!rec[email];
      if (present) presentCount++;
      const when = new Date(s.createdAt).toLocaleString();
      rows += `
        <tr>
          <td>${when}</td>
          <td>${present ? 'Present' : 'Absent'}</td>
        </tr>
      `;
    });

    const pct = total ? Math.round((presentCount / total) * 100) : 0;

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
  }

  function openPanel() {
    panel.style.display = 'block';
    codeInput.value = '';
    statusEl.textContent = '';
    renderHistory();
  }

  function closePanel() {
    panel.style.display = 'none';
  }

  submitBtn.addEventListener('click', () => {
    const code = (codeInput.value || '').trim().toUpperCase();
    if (!code) {
      statusEl.textContent = 'Please enter a code.';
      statusEl.style.color = '#b00020';
      return;
    }

    const sessions = getAttendanceSessions(classId);
    const now = new Date();

    const match = sessions.find(
      (s) =>
        s.code.toUpperCase() === code &&
        now >= new Date(s.createdAt) &&
        now <= new Date(s.expiresAt)
    );

    if (!match) {
      statusEl.textContent =
        'Code not found or expired. Make sure you enter it during the class window.';
      statusEl.style.color = '#b00020';
      return;
    }

    markAttendancePresent(classId, match.id, email);
    statusEl.textContent = 'You are marked present for this session.';
    statusEl.style.color = '#0a7a30';
    renderHistory();
  });

  openBtn.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closePanel();
  });
});