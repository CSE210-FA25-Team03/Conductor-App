document.addEventListener('DOMContentLoaded', () => {
  const {
    getCurrentUser,
    getAttendanceSessions,
    getAttendanceRecords,
    markAttendancePresent
  } = window.ConductorStorage || {};

  // Storage missing → stop
  if (!getCurrentUser) return;

  // UI Elements
  const openBtn = document.getElementById('openStudentAttendanceBtn');
  const panel = document.getElementById('studentAttendancePanel');
  const drawer = document.querySelector('.attendance-drawer');

  if (!openBtn || !panel) return;

  const codeInput = document.getElementById('studentAttendanceCodeInput');
  const submitBtn = document.getElementById('studentAttendanceSubmitBtn');
  const statusEl = document.getElementById('studentAttendanceStatus');
  const historyContainer = document.getElementById('studentAttendanceHistory');
  const closeBtn = document.getElementById('studentAttendanceCloseBtn');

  // User
  const user = getCurrentUser();
  if (!user || !user.classId) return;
  const classId = user.classId;
  const email = (user.email || "").toLowerCase();

  // Render Attendance History
  function renderHistory() {
    const sessions = getAttendanceSessions(classId) || [];
    const records = getAttendanceRecords(classId) || {};

    if (sessions.length === 0) {
      historyContainer.innerHTML = `<p style="color:#777;">No sessions yet.</p>`;
      return;
    }

    let rows = "";
    let presentCount = 0;
    const sorted = sessions.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    sorted.forEach(s => {
      const rec = records[s.id] || {};
      const isPresent = !!rec[email];
      if (isPresent) presentCount++;

      rows += `
        <tr>
          <td style="border:1px solid #eee; padding:4px;">${new Date(s.createdAt).toLocaleString()}</td>
          <td style="border:1px solid #eee; padding:4px;">${isPresent ? "Present" : "Absent"}</td>
        </tr>`;
    });

    const pct = Math.round((presentCount / sorted.length) * 100);

    historyContainer.innerHTML = `
      <p><strong>${presentCount}/${sorted.length}</strong> sessions (${pct}%)</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr>
            <th style="border:1px solid #eee;padding:4px;">Session</th>
            <th style="border:1px solid #eee;padding:4px;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // OPEN drawer
  function openPanel() {
    panel.style.display = "flex";
    setTimeout(() => panel.classList.add("open"), 10);

    codeInput.value = "";
    statusEl.textContent = "";
    renderHistory();
  }

  // CLOSE drawer
  function closePanel() {
    panel.classList.remove("open");
    setTimeout(() => (panel.style.display = "none"), 250);
  }

  // Submit attendance code
  submitBtn.addEventListener("click", () => {
    openPanel();
    const code = (codeInput.value || "").trim().toUpperCase();
    if (!code) {
      statusEl.textContent = "Please enter a code.";
      statusEl.style.color = "#b00020";
      return;
    }

    const sessions = getAttendanceSessions(classId) || [];
    const now = new Date();

    const match = sessions.find(
      s =>
        s.code.toUpperCase() === code &&
        now >= new Date(s.createdAt) &&
        now <= new Date(s.expiresAt)
    );

    if (!match) {
      statusEl.textContent = "Invalid or expired code.";
      statusEl.style.color = "#b00020";
      return;
    }

    markAttendancePresent(classId, match.id, email);

    statusEl.textContent = "You are marked present!";
    statusEl.style.color = "#0a7a30";
    renderHistory();
  });

  // Event Listeners
  openBtn.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);

  // Click outside drawer closes panel
  panel.addEventListener("click", e => {
    if (e.target === panel) closePanel();
  });
});
