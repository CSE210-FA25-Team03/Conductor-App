// Shared attendance plot component
// Usage: Include Chart.js CDN and call initAttendancePlot(teamId, role, courseId)

// eslint-disable-next-line no-unused-vars
function initAttendancePlot(teamId, role, _courseId) {
  const API_BASE = '/api';
  const plotPanel = document.getElementById('attendancePlotPanel');
  const openBtn = document.getElementById('viewAttendanceBtn');
  const closeBtn = document.querySelector('.close-attendance-plot');
  const teamSelect = document.getElementById('attendanceTeamSelect');
  const classPlotContainer = document.getElementById('classAttendancePlot');
  const teamPlotContainer = document.getElementById('teamAttendancePlot');
  const classPlotSection = document.getElementById('classPlotSection');
  const teamPlotSection = document.getElementById('teamPlotSection');

  if (!plotPanel || !openBtn) return;

  // Chart instances stored for potential cleanup (currently unused but kept for future use)
  // eslint-disable-next-line no-unused-vars
  let _classChart = null;
  // eslint-disable-next-line no-unused-vars
  let _teamChart = null;

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadTeams() {
    if (!teamSelect || role === 'student' || role === 'team_lead') return;
    try {
      const teams = await fetchJSON(`${API_BASE}/teams`);
      teamSelect.innerHTML = '<option value="">Select a team...</option>';
      teams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name || team.code;
        teamSelect.appendChild(option);
      });
      if (teams.length === 1) {
        teamSelect.value = teams[0].id;
        loadPlots(teams[0].id);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  }

  async function loadPlots(selectedTeamId) {
    if (!selectedTeamId) return;

    // Load class meeting plot
    try {
      const classData = await fetchJSON(`${API_BASE}/attendance/plot?teamId=${selectedTeamId}&type=class_meeting`);
      renderPlot(classPlotContainer, classData, 'Class Meeting Attendance', '#2196F3');
      updateStats(classPlotSection, classData, 'Students');
    } catch (err) {
      console.error('Failed to load class plot:', err);
      classPlotContainer.innerHTML = '<p style="color:#b00020;">Failed to load class attendance plot.</p>';
    }

    // Load team meeting plot (only for students/team leads)
    if (role === 'student' || role === 'team_lead') {
      try {
        const teamData = await fetchJSON(`${API_BASE}/attendance/plot?teamId=${selectedTeamId}&type=team_meeting`);
        renderPlot(teamPlotContainer, teamData, 'Team Meeting Attendance', '#4CAF50');
        updateStats(teamPlotSection, teamData, 'Members');
      } catch (err) {
        console.error('Failed to load team plot:', err);
        teamPlotContainer.innerHTML = '<p style="color:#b00020;">Failed to load team attendance plot.</p>';
      }
    }
  }

  function renderPlot(container, data, title, color) {
    if (!container || !data.periods || data.periods.length === 0) {
      container.innerHTML = '<p style="color:#666;">No attendance data available.</p>';
      return;
    }

    const canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const labels = data.periods.map((p) => p.label);
    const rates = data.periods.map((p) => p.attendanceRate);

    if (window.Chart) {
      const chart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Attendance Rate (%)',
            data: rates,
            borderColor: color,
            backgroundColor: color + '20',
            fill: true,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { stepSize: 10 },
            },
          },
          plugins: {
            legend: { display: true },
            title: { display: true, text: title },
          },
        },
      });
      // Store chart instance for potential cleanup
      if (container === classPlotContainer) {
        _classChart = chart;
      } else if (container === teamPlotContainer) {
        _teamChart = chart;
      }
    } else {
      container.innerHTML = '<p style="color:#b00020;">Chart.js not loaded. Please include Chart.js library.</p>';
    }
  }

  function updateStats(section, data, memberLabel) {
    if (!section) return;
    const statsEl = section.querySelector('.plot-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div><strong>Average Rate:</strong> ${data.averageRate}%</div>
        <div><strong>Total ${memberLabel}:</strong> ${data.totalMembers}</div>
        <div><strong>Total Periods:</strong> ${data.totalPeriods}</div>
      `;
    }
  }

  function openPanel() {
    plotPanel.setAttribute('aria-hidden', 'false');
    if (role === 'student' || role === 'team_lead') {
      loadPlots(teamId);
    } else if (teamSelect) {
      loadTeams();
    }
  }

  function closePanel() {
    plotPanel.setAttribute('aria-hidden', 'true');
  }

  openBtn.addEventListener('click', openPanel);
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (plotPanel) {
    plotPanel.addEventListener('click', (e) => {
      if (e.target === plotPanel) closePanel();
    });
  }

  if (teamSelect) {
    teamSelect.addEventListener('change', (e) => {
      loadPlots(e.target.value);
    });
  }

  // Toggle sections
  const classToggle = document.getElementById('toggleClassPlot');
  const teamToggle = document.getElementById('toggleTeamPlot');
  if (classToggle && classPlotSection) {
    classToggle.addEventListener('click', () => {
      const isHidden = classPlotSection.style.display === 'none';
      classPlotSection.style.display = isHidden ? 'block' : 'none';
      classToggle.textContent = isHidden ? 'Hide' : 'Show';
    });
  }
  if (teamToggle && teamPlotSection) {
    teamToggle.addEventListener('click', () => {
      const isHidden = teamPlotSection.style.display === 'none';
      teamPlotSection.style.display = isHidden ? 'block' : 'none';
      teamToggle.textContent = isHidden ? 'Hide' : 'Show';
    });
  }
}

