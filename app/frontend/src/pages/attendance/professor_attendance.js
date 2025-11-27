document.addEventListener("DOMContentLoaded", () => {
  /* --------------------------------------------------------------------------
     DEMO USER + LOCAL STORAGE FALLBACK
  -------------------------------------------------------------------------- */

  // Inline demo user for testing (no backend)
  const demoUser = {
    email: "professor@school.edu",
    role: "professor",
    classId: "CSE210"
  };

  // In-page memory for attendance
  let attendanceSessions = [];
  let attendanceRecords = {};

  // Returns the current user (demo fallback)
  function getCurrentUser() {
    try {
      const stored = JSON.parse(localStorage.getItem("currentUser"));
      return stored || demoUser;
    } catch {
      return demoUser;
    }
  }

  // Save new user to localStorage
  function saveCurrentUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
  }

  // Sessions helpers
  function getAttendanceSessions() {
    return attendanceSessions;
  }

  function saveAttendanceSessions(sessions) {
    attendanceSessions = sessions;
  }

  function getAttendanceRecords() {
    return attendanceRecords;
  }

  /* --------------------------------------------------------------------------
     ENSURE A VALID PROFESSOR USER
  -------------------------------------------------------------------------- */
  const user = getCurrentUser();

  if (!user || user.role !== "professor" || !user.classId) {
    saveCurrentUser(demoUser);
  }

  const currentUser = getCurrentUser();
  const classId = currentUser.classId;

  if (!classId) {
    alert("Missing class ID.");
    return;
  }

  /* --------------------------------------------------------------------------
     DOM ELEMENTS
  -------------------------------------------------------------------------- */
  const durationInput = document.getElementById("attendanceDuration");
  const generateBtn = document.getElementById("generateAttendanceCodeBtn");
  const codeDisplay = document.getElementById("currentCodeDisplay");
  const sessionsContainer = document.getElementById("attendanceSessionsContainer");

  const profileImg = document.getElementById("dashboardProfileImg");
  const dropdown = document.getElementById("profileDropdown");
  const backDashboardBtn = document.getElementById("backDashboard");

  /* --------------------------------------------------------------------------
     PROFILE DROPDOWN
  -------------------------------------------------------------------------- */
  if (profileImg && dropdown) {
      profileImg.addEventListener("mouseenter", () => {
        dropdown.style.display = "block";
      });

      profileImg.addEventListener("mouseleave", () => {
        setTimeout(() => {
          if (!dropdown.matches(":hover")) dropdown.style.display = "none";
        }, 150);
      });

      dropdown.addEventListener("mouseleave", () => {
        dropdown.style.display = "none";
      });

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.clear();
          window.location.href = "/login";
        });
      }

      const savedImg = localStorage.getItem("profileImg");
      if (savedImg) profileImg.src = savedImg;
  }

  /* --------------------------------------------------------------------------
     BACK BUTTON
  -------------------------------------------------------------------------- */
  if (backDashboardBtn) {
    backDashboardBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const role = localStorage.getItem("role");

      switch (role) {
        case "professor":
          window.location.href = "/dashboards/professor.html";
          break;
        case "Teaching Assistant":
          window.location.href = "/dashboards/ta.html";
          break;
        case "team_lead":
          window.location.href = "/dashboards/team_lead.html";
          break;
        default:
          window.location.href = "/dashboards/student.html";
      }
    });
  }

  /* --------------------------------------------------------------------------
     LOAD ATTENDANCE SESSIONS UI
  -------------------------------------------------------------------------- */
  function loadSessionsUI() {
    const sessions = getAttendanceSessions();
    const records = getAttendanceRecords();

    if (!sessions.length) {
      sessionsContainer.innerHTML =
        `<p style="color:#777;font-size:0.9rem">No attendance sessions yet.</p>`;
      return;
    }

    let rows = "";

    sessions
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((s) => {
        const rec = records[s.id] || {};
        const presentCount = Object.keys(rec).length;
        const expired = new Date() > new Date(s.expiresAt);

        rows += `
          <tr>
            <td>${new Date(s.createdAt).toLocaleString()}</td>
            <td>${s.code}</td>
            <td>${presentCount}</td>
            <td>${expired ? "Closed" : "Open"}</td>
          </tr>`;
      });

    sessionsContainer.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Session Time</th>
            <th>Code</th>
            <th># Present</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /* --------------------------------------------------------------------------
     GENERATE RANDOM CODE
  -------------------------------------------------------------------------- */
  function generateRandomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /* --------------------------------------------------------------------------
     GENERATE ATTENDANCE SESSION
  -------------------------------------------------------------------------- */
  generateBtn.addEventListener("click", () => {
    const minutes = Math.max(
      1,
      Math.min(60, parseInt(durationInput.value.trim(), 10) || 10)
    );

    const sessions = getAttendanceSessions();
    const now = new Date();

    const sessionId = `${classId}-${now.getTime()}`;
    const code = generateRandomCode();
    const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);

    sessions.push({
      id: sessionId,
      code,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    saveAttendanceSessions(sessions);

    codeDisplay.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">Current Code:</div>
      <div style="font-size:1.4rem;letter-spacing:4px;">${code}</div>
      <div style="font-size:0.85rem;color:#555;margin-top:4px;">
        Expires at ${expiresAt.toLocaleTimeString()}
      </div>
    `;

    loadSessionsUI();
  });

  /* --------------------------------------------------------------------------
     INITIAL LOAD
  -------------------------------------------------------------------------- */
  loadSessionsUI();
});
