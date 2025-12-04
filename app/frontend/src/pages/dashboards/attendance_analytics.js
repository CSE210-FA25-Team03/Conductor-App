// attendance_analytics.js
// Team and Class attendance overview components with time-series charts

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';

  // Load Chart.js from CDN if not already loaded
  if (typeof Chart === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = initializeAnalytics;
    document.head.appendChild(script);
  } else {
    initializeAnalytics();
  }

  function initializeAnalytics() {
    // Initialize team attendance overview if element exists
    const teamOverviewContainer = document.getElementById('teamAttendanceOverview');
    if (teamOverviewContainer) {
      loadTeamAttendanceOverview();
    }

    // Initialize class attendance overview if element exists
    const classOverviewContainer = document.getElementById('classAttendanceOverview');
    if (classOverviewContainer) {
      loadClassAttendanceOverview();
    }
  }

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
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser'));
      if (stored && stored.email) return stored;
    } catch {
      /* ignore */
    }

    const email = localStorage.getItem('email') || 'student@school.edu';
    const role = localStorage.getItem('role') || 'student';

    return {
      email,
      role,
      classId: 'CSE210',
    };
  }

  // ---------------------------------------------------------------------------
  // Team Attendance Overview
  // ---------------------------------------------------------------------------
  async function loadTeamAttendanceOverview() {
    const container = document.getElementById('teamAttendanceOverview');
    if (!container) return;

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.email) return;

    try {
      // Get user's teams from API
      const teams = await fetchJSON(
        `${API_BASE}/my-teams?email=${encodeURIComponent(currentUser.email)}`,
      );

      if (!teams || teams.length === 0) {
        container.innerHTML = '<p style="color: #777; padding: 1rem;">No team assigned</p>';
        return;
      }

      // Use the first team (or could show all teams)
      const team = teams[0];
      const teamId = team.id;

      const result = await fetchJSON(`${API_BASE}/attendance/weekly/team/${teamId}`);

      if (!result || !result.periods || result.periods.length === 0) {
        container.innerHTML = '<p style="color: #777; padding: 1rem;">No attendance data available</p>';
        return;
      }

      renderTeamOverview(container, result);
    } catch (err) {
      console.error('Failed to load team attendance overview:', err);
      container.innerHTML = '<p style="color: #b00020; padding: 1rem;">Failed to load team attendance data</p>';
    }
  }

  function renderTeamOverview(container, data) {
    const { periods, summary, totalMembers } = data;

    container.innerHTML = `
      <div class="attendance-overview-card">
        <h3>Team Attendance Overview</h3>
        <div class="attendance-metrics">
          <div class="metric">
            <span class="metric-label">Average Rate</span>
            <span class="metric-value">${Math.round((summary.averageRate || 0) * 100)}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Members</span>
            <span class="metric-value">${totalMembers || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Periods</span>
            <span class="metric-value">${periods.length}</span>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="teamAttendanceChart"></canvas>
        </div>
      </div>
    `;

    // Create chart
    const ctx = document.getElementById('teamAttendanceChart');
    if (ctx && typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: periods.map((p) => p.label || p.periodStart),
          datasets: [
            {
              label: 'Attendance Rate (%)',
              data: periods.map((p) => Math.round((p.attendanceRate || 0) * 100)),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const index = context.dataIndex;
                  const period = periods[index];
                  return [
                    `Attendance: ${Math.round((period.attendanceRate || 0) * 100)}%`,
                    `Period: ${period.periodStart} - ${period.periodEnd}`,
                    `Users with records: ${period.usersWithRecords || 0}/${period.totalTeamMembers || 0}`,
                  ];
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + '%';
                },
              },
            },
          },
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Class Attendance Overview
  // ---------------------------------------------------------------------------
  async function loadClassAttendanceOverview() {
    const container = document.getElementById('classAttendanceOverview');
    if (!container) return;

    try {
      const result = await fetchJSON(`${API_BASE}/attendance/weekly/class`);
      
      if (!result || !result.periods || result.periods.length === 0) {
        container.innerHTML = '<p style="color: #777; padding: 1rem;">No attendance data available</p>';
        return;
      }

      renderClassOverview(container, result);
    } catch (err) {
      console.error('Failed to load class attendance overview:', err);
      container.innerHTML = '<p style="color: #b00020; padding: 1rem;">Failed to load class attendance data</p>';
    }
  }

  function renderClassOverview(container, data) {
    const { periods, summary, totalStudents } = data;

    container.innerHTML = `
      <div class="attendance-overview-card">
        <h3>Class Attendance Overview</h3>
        <div class="attendance-metrics">
          <div class="metric">
            <span class="metric-label">Average Rate</span>
            <span class="metric-value">${Math.round((summary.averageRate || 0) * 100)}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Students</span>
            <span class="metric-value">${totalStudents || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Periods</span>
            <span class="metric-value">${periods.length}</span>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="classAttendanceChart"></canvas>
        </div>
      </div>
    `;

    // Create chart
    const ctx = document.getElementById('classAttendanceChart');
    if (ctx && typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: periods.map((p) => p.label || p.periodStart),
          datasets: [
            {
              label: 'Attendance Rate (%)',
              data: periods.map((p) => Math.round((p.attendanceRate || 0) * 100)),
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const index = context.dataIndex;
                  const period = periods[index];
                  return [
                    `Attendance: ${Math.round((period.attendanceRate || 0) * 100)}%`,
                    `Period: ${period.periodStart} - ${period.periodEnd}`,
                    `Users with records: ${period.usersWithRecords || 0}/${period.totalStudents || 0}`,
                  ];
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + '%';
                },
              },
            },
          },
        },
      });
    }
  }
});

