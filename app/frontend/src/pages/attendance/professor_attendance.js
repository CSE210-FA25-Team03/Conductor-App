document.addEventListener("DOMContentLoaded", () => {
  // Dummy data for demo/testing (no shared storage.js required)
  const demoUser = {
    email: "professor@school.edu",
    role: "professor",
    classId: "CSE210"
  };
  let attendanceSessions = [];
  let attendanceRecords = {};

  function getCurrentUser() {
    return demoUser;
  }
  function getAttendanceSessions(classId) {
    return attendanceSessions;
  }
  function saveAttendanceSessions(classId, sessions) {
    attendanceSessions = sessions;
  }
  function getAttendanceRecords(classId) {
    return attendanceRecords;
  }
  // ...existing code...
  // DEMO: Set a default professor user if not present
  if (!getCurrentUser() || getCurrentUser().role !== "professor" || !getCurrentUser().classId) {
    setCurrentUser({
      email: "professor@school.edu",
      role: "professor",
      classId: "CSE210",
    });
  }

  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== "professor") {
    alert("You must be logged in as a professor.");
    return;
  }

  const classId = currentUser.classId;
  if (!classId) {
    alert("No classId found.");
    return;
  }

  const durationInput = document.getElementById("attendanceDuration");
  const generateBtn = document.getElementById("generateAttendanceCodeBtn");
  const codeDisplay = document.getElementById("currentCodeDisplay");
  const sessionsContainer = document.getElementById("attendanceSessionsContainer");

  /* --------------------------------------------------------------------------
     PROFILE DROPDOWN LOGIC (Fully Fixed)
  -------------------------------------------------------------------------- */
  const profileImg = document.getElementById("dashboardProfileImg");
  const dropdown = document.getElementById("profileDropdown");

  if (profileImg && dropdown) {
    profileImg.addEventListener("mouseenter", () => {
      dropdown.style.display = "block";
    });

    profileImg.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!dropdown.matches(":hover")) dropdown.style.display = "none";
      }, 150);
    });

    dropdown.addEventListener("mouseenter", () => {
      dropdown.style.display = "block";
    });

    dropdown.addEventListener("mouseleave", () => {
      dropdown.style.display = "none";
    });

    document.getElementById("logoutBtn").addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = "/login";
    });
  }

  /* --------------------------------------------------------------------------
     PROFILE IMAGE LOADING
  -------------------------------------------------------------------------- */
  const savedImg = localStorage.getItem("profileImg");
  if (savedImg) {
    profileImg.src = savedImg;
  }

  /* --------------------------------------------------------------------------
     BACK TO DASHBOARD
  -------------------------------------------------------------------------- */
  const backDashboardBtn = document.getElementById("backDashboard");
  if (backDashboardBtn) {
    backDashboardBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const role = localStorage.getItem("role");

      if (role === "professor") {
        window.location.href = "/dashboards/professor.html";
      } else if (role === "Teaching Assistant") {
        window.location.href = "/dashboards/ta.html";
      } else if (role === "team_lead") {
        window.location.href = "/dashboards/team_lead.html";
      } else {
        window.location.href = "/dashboards/student.html";
      }
    });
  }

  /* --------------------------------------------------------------------------
     LOAD ATTENDANCE SESSION TABLE
  -------------------------------------------------------------------------- */
  function loadSessionsUI() {
    const sessions = getAttendanceSessions(classId);
    const records = getAttendanceRecords(classId);

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
     GENERATE ATTENDANCE CODE
  -------------------------------------------------------------------------- */
  function generateRandomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  generateBtn.addEventListener("click", () => {
    const minutes = Math.max(
      1,
      Math.min(60, parseInt(durationInput.value.trim(), 10) || 10)
    );

    const sessions = getAttendanceSessions(classId);
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

    saveAttendanceSessions(classId, sessions);

    codeDisplay.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">Current Code:</div>
      <div style="font-size:1.4rem;letter-spacing:4px;">${code}</div>
      <div style="font-size:0.85rem;color:#555;margin-top:4px;">
        Expires at ${expiresAt.toLocaleTimeString()}
      </div>
    `;

    loadSessionsUI();
  });

  // Initial load
  loadSessionsUI();
});
