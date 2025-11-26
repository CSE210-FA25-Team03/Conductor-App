/* global Chart */

let teamComparisonChart = null;
let teamTrendChart = null;
let classTrendChart = null;
let attendanceByTypeChart = null;
let classAttendanceChart = null;
let lectureChart = null;
let meetingChart = null;
let officeHoursChart = null;
let currentUserTeamId = null;
let allTeams = [];
let allMembers = [];

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
  setupEventListeners();
  loadUserData();
});

async function loadUserData() {
  try {
    // Load teams for selector
    const teamsResponse = await fetch('/api/teams');
    if (teamsResponse.ok) {
      allTeams = await teamsResponse.json();
    }

    // Load members to get current user's teamId
    const membersResponse = await fetch('/api/members');
    if (membersResponse.ok) {
      allMembers = await membersResponse.json();
      
      const role = localStorage.getItem('role');
      const firstName = localStorage.getItem('firstName');
      const lastName = localStorage.getItem('lastName');
      const userFullName = `${firstName || ''} ${lastName || ''}`.trim();
      
      if (role === 'student' || role === 'team_lead') {
        // Find current user's teamId with multiple matching strategies
        const currentUserEmail = localStorage.getItem('email');
        
        // Strategy 1: Exact name match
        let currentUser = allMembers.find(m => 
          m.name.toLowerCase().trim() === userFullName.toLowerCase().trim()
        );
        
        // Strategy 2: Email match
        if (!currentUser && currentUserEmail) {
          currentUser = allMembers.find(m => 
            m.email && m.email.toLowerCase() === currentUserEmail.toLowerCase()
          );
        }
        
        // Strategy 3: Partial name match
        if (!currentUser && firstName && lastName) {
          currentUser = allMembers.find(m => {
            const memberName = m.name.toLowerCase();
            return memberName.includes(firstName.toLowerCase()) && memberName.includes(lastName.toLowerCase());
          });
        }
        
        if (currentUser && currentUser.teamId) {
          currentUserTeamId = currentUser.teamId;
        }
      }
    }

    // Setup team selector for professors/TAs
    const role = localStorage.getItem('role');
    if (role === 'professor' || role === 'Teaching Assistant') {
      setupTeamSelector();
    }

    loadAttendanceData();
  } catch (error) {
    console.error('Error loading user data:', error);
    loadAttendanceData();
  }
}

function setupTeamSelector() {
  const teamSelector = document.getElementById('teamSelector');
  const teamSelectorSection = document.getElementById('teamSelectorSection');
  
  if (teamSelector && teamSelectorSection) {
    teamSelectorSection.style.display = 'block';
    
    // Populate team selector
    allTeams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name || `Team ${team.id}`;
      teamSelector.appendChild(option);
    });
    
    // Add event listener
    teamSelector.addEventListener('change', () => {
      loadAttendanceData();
    });
  }
}

function initializePage() {
  // Check if user is professor or TA
  const role = localStorage.getItem('role');
  if (role === 'professor' || role === 'Teaching Assistant') {
    document.getElementById('classOverviewSection').style.display = 'block';
  }
}

function setupEventListeners() {
  // Back button
  document.getElementById('backBtn').addEventListener('click', () => {
    const role = localStorage.getItem('role');
    if (role === 'professor') {
      window.location.href = '/dashboards/professor.html';
    } else if (role === 'Teaching Assistant') {
      window.location.href = '/dashboards/ta.html';
    } else if (role === 'team_lead') {
      window.location.href = '/dashboards/team_lead.html';
    } else {
      window.location.href = '/dashboards/student.html';
    }
  });

  // Time range filters
  document.getElementById('teamTimeRange').addEventListener('change', () => {
    const role = localStorage.getItem('role');
    const teamIdFilter = getTeamIdFilter(role);
    loadTeamTrendChart(teamIdFilter);
  });

  const classTimeRange = document.getElementById('classTimeRange');
  if (classTimeRange) {
    classTimeRange.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = getTeamIdFilter(role);
      loadClassTrendChart(teamIdFilter);
    });
  }

  // Type-based chart time range filters
  const typeTimeRange = document.getElementById('typeTimeRange');
  if (typeTimeRange) {
    typeTimeRange.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = getTeamIdFilter(role);
      loadAttendanceByTypeChart(teamIdFilter);
    });
  }

  const classAttendanceTimeRange = document.getElementById('classAttendanceTimeRange');
  if (classAttendanceTimeRange) {
    classAttendanceTimeRange.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = getTeamIdFilter(role);
      loadClassAttendanceChart(teamIdFilter);
    });
  }

  const lectureTimeRange = document.getElementById('lectureTimeRange');
  if (lectureTimeRange) {
    lectureTimeRange.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = getTeamIdFilter(role);
      loadLectureChart(teamIdFilter);
    });
  }

  const meetingTimeRange = document.getElementById('meetingTimeRange');
  if (meetingTimeRange) {
    meetingTimeRange.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = getTeamIdFilter(role);
      loadMeetingChart(teamIdFilter);
    });
  }

  const officeHoursTimeRange = document.getElementById('officeHoursTimeRange');
  if (officeHoursTimeRange) {
    officeHoursTimeRange.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = getTeamIdFilter(role);
      loadOfficeHoursChart(teamIdFilter);
    });
  }
  
  // Team selector (for professors/TAs)
  const teamSelector = document.getElementById('teamSelector');
  if (teamSelector) {
    teamSelector.addEventListener('change', () => {
      loadAttendanceData();
    });
  }

  // Action buttons
  const markAttendanceBtn = document.getElementById('markAttendanceBtn');
  if (markAttendanceBtn) {
    markAttendanceBtn.addEventListener('click', () => {
      window.location.href = '/attendance/quick-entry.html';
    });
  }

  const viewHistoryBtn = document.getElementById('viewHistoryBtn');
  if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', () => {
      window.location.href = '/attendance/history.html';
    });
  }
}

function getTeamIdFilter(role) {
  if ((role === 'student' || role === 'team_lead') && currentUserTeamId) {
    return currentUserTeamId;
  }
  if (role === 'professor' || role === 'Teaching Assistant') {
    const teamSelector = document.getElementById('teamSelector');
    if (teamSelector && teamSelector.value) {
      return parseInt(teamSelector.value, 10);
    }
  }
  return null;
}

async function loadAttendanceData() {
  try {
    const role = localStorage.getItem('role');
    let teamIdFilter = null;
    
    // For students and team leads, filter by their team
    if ((role === 'student' || role === 'team_lead') && currentUserTeamId) {
      teamIdFilter = currentUserTeamId;
    }
    // For professors/TAs, use selected team (or all if none selected)
    else if (role === 'professor' || role === 'Teaching Assistant') {
      const teamSelector = document.getElementById('teamSelector');
      if (teamSelector && teamSelector.value) {
        teamIdFilter = parseInt(teamSelector.value, 10);
      }
    }

    // Load summary stats with team filter
    const statsUrl = teamIdFilter 
      ? `/api/attendance/stats/summary?teamId=${teamIdFilter}`
      : '/api/attendance/stats/summary';
    const statsResponse = await fetch(statsUrl);
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      updateSummaryCards(stats, teamIdFilter);
    }

    // Load team comparison
    loadTeamComparison(teamIdFilter);

    // Load charts
    loadTeamTrendChart(teamIdFilter);
    
    if (role === 'professor' || role === 'Teaching Assistant') {
      loadClassTrendChart(teamIdFilter);
    }

    // Load type-based charts
    try {
      await loadAttendanceByTypeChart(teamIdFilter);
    } catch (error) {
      console.error('Error loading attendance by type chart:', error);
    }
    
    try {
      await loadClassAttendanceChart(teamIdFilter);
    } catch (error) {
      console.error('Error loading class attendance chart:', error);
    }
    
    try {
      await loadLectureChart(teamIdFilter);
    } catch (error) {
      console.error('Error loading lecture chart:', error);
    }
    
    try {
      await loadMeetingChart(teamIdFilter);
    } catch (error) {
      console.error('Error loading meeting chart:', error);
    }
    
    try {
      await loadOfficeHoursChart(teamIdFilter);
    } catch (error) {
      console.error('Error loading office hours chart:', error);
    }
  } catch (error) {
    console.error('Error loading attendance data:', error);
  }
}

function updateSummaryCards(stats, teamIdFilter) {
  // Update label based on whether filtering by team
  const role = localStorage.getItem('role');
  const labelElement = document.querySelector('.summary-card .summary-label');
  if (labelElement) {
    if (teamIdFilter && (role === 'student' || role === 'team_lead')) {
      const team = allTeams.find(t => t.id === teamIdFilter);
      const teamName = team ? team.name : `Team ${teamIdFilter}`;
      labelElement.textContent = `${teamName} Average`;
    } else {
      labelElement.textContent = 'Class Average';
    }
  }

  // Check if stats data is valid
  if (!stats) {
    console.error('Invalid stats data');
    return;
  }

  // For single team view, use team average; otherwise use class average
  const average = teamIdFilter && 
                  stats.teamComparison && 
                  Array.isArray(stats.teamComparison) && 
                  stats.teamComparison.length === 1
    ? stats.teamComparison[0].percentage || 0
    : stats.classAverage || 0;
  
  const classAverageEl = document.getElementById('classAverage');
  if (classAverageEl) {
    classAverageEl.textContent = `${average}%`;
  }
  
  const totalRecordsEl = document.getElementById('totalRecords');
  if (totalRecordsEl) {
    totalRecordsEl.textContent = stats.totalRecords || 0;
  }
  
  // Calculate week average (simplified - would need actual week calculation)
  const weekAverageEl = document.getElementById('weekAverage');
  if (weekAverageEl) {
    weekAverageEl.textContent = `${average}%`;
  }
}

async function loadTeamComparison(teamIdFilter) {
  try {
    const url = teamIdFilter 
      ? `/api/attendance/stats/teams/current?teamId=${teamIdFilter}`
      : '/api/attendance/stats/teams/current';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load team comparison');
    
    const data = await response.json();
    
    // Check if data is valid
    if (!data || !data.teamComparison || !Array.isArray(data.teamComparison)) {
      console.error('Invalid team comparison data:', data);
      return;
    }
    
    // If filtering by team and no data, show empty state
    if (teamIdFilter && data.teamComparison.length === 0) {
      const canvas = document.getElementById('teamComparisonChart');
      if (canvas) {
        if (teamComparisonChart) {
          teamComparisonChart.destroy();
          teamComparisonChart = null;
        }
        // Show empty chart or message
        return;
      }
    }
    
    const canvas = document.getElementById('teamComparisonChart');
    if (!canvas) {
      console.error('Team comparison chart canvas not found');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    
    if (teamComparisonChart) {
      teamComparisonChart.destroy();
    }

    teamComparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.teamComparison.map(t => t.teamName || `Team ${t.teamId}`),
        datasets: [{
          label: 'Attendance %',
          data: data.teamComparison.map(t => t.percentage || 0),
          backgroundColor: data.teamComparison.map((_, i) => 
            `hsl(${220 + i * 30}, 70%, 60%)`
          ),
          borderColor: data.teamComparison.map((_, i) => 
            `hsl(${220 + i * 30}, 70%, 50%)`
          ),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.x + '%';
              }
            }
          },
          legend: {
            display: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading team comparison:', error);
  }
}

async function loadTeamTrendChart(teamIdFilter) {
  try {
    const timeRange = document.getElementById('teamTimeRange').value;
    const { dateFrom, dateTo } = getDateRange(timeRange);
    
    let url = `/api/attendance/stats/teams?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week`;
    if (teamIdFilter) {
      url += `&teamId=${teamIdFilter}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load team trends');
    
    const data = await response.json();
    
    // Check if data is valid
    if (!data || !data.teams || !Array.isArray(data.teams)) {
      console.error('Invalid team trend data:', data);
      return;
    }
    
    // If no teams in data, show empty state
    if (data.teams.length === 0) {
      const canvas = document.getElementById('teamTrendChart');
      if (canvas) {
        if (teamTrendChart) {
          teamTrendChart.destroy();
          teamTrendChart = null;
        }
      }
      return;
    }
    
    const canvas = document.getElementById('teamTrendChart');
    if (!canvas) {
      console.error('Team trend chart canvas not found');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    
    if (teamTrendChart) {
      teamTrendChart.destroy();
    }

    // Prepare datasets for each team
    const datasets = data.teams.map((team, index) => ({
      label: team.teamName || `Team ${team.teamId}`,
      data: (team.data && Array.isArray(team.data)) 
        ? team.data.map(d => d.percentage || 0)
        : [],
      borderColor: `hsl(${220 + index * 30}, 70%, 50%)`,
      backgroundColor: `hsla(${220 + index * 30}, 70%, 50%, 0.1)`,
      tension: 0.4,
      fill: false
    }));

    // Get labels from first team's data
    const labels = data.teams.length > 0 && 
                   data.teams[0].data && 
                   Array.isArray(data.teams[0].data) && 
                   data.teams[0].data.length > 0
      ? data.teams[0].data.map(d => formatDateLabel(d.date || ''))
      : [];

    teamTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y + '%';
              }
            }
          },
          legend: {
            display: true,
            position: 'bottom'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading team trend chart:', error);
  }
}

async function loadClassTrendChart(teamIdFilter) {
  try {
    const timeRange = document.getElementById('classTimeRange').value;
    const { dateFrom, dateTo } = getDateRange(timeRange);
    
    // Class trend chart shows overall class average, but can be filtered by team
    // For now, if teamIdFilter is set, we'll show that team's trend instead
    let url = `/api/attendance/stats/class?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week`;
    if (teamIdFilter) {
      // If filtering by team, use team stats endpoint instead
      url = `/api/attendance/stats/teams?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week&teamId=${teamIdFilter}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load team trends');
      const data = await response.json();
      
      // Use team data for class chart when filtered
      if (data.teams && data.teams.length > 0) {
        const team = data.teams[0];
        const ctx = document.getElementById('classTrendChart').getContext('2d');
        if (classTrendChart) {
          classTrendChart.destroy();
        }
        
        const labels = team.data.map(d => formatDateLabel(d.date));
        const percentages = team.data.map(d => d.percentage);
        
        classTrendChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: team.teamName,
              data: percentages,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: function(value) {
                    return value + '%';
                  }
                }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return team.teamName + ': ' + context.parsed.y + '%';
                  }
                }
              },
              legend: {
                display: false
              }
            }
          }
        });
        return;
      }
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load class trends');
    
    const data = await response.json();
    
    // Check if data is valid
    if (!data || !data.classAverage || !Array.isArray(data.classAverage)) {
      console.error('Invalid class trend data:', data);
      return;
    }
    
    const canvas = document.getElementById('classTrendChart');
    if (!canvas) {
      console.error('Class trend chart canvas not found');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    
    if (classTrendChart) {
      classTrendChart.destroy();
    }

    const labels = data.classAverage.map(d => formatDateLabel(d.date || ''));
    const percentages = data.classAverage.map(d => d.percentage || 0);

    classTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Class Average',
          data: percentages,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Class Average: ' + context.parsed.y + '%';
              }
            }
          },
          legend: {
            display: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading class trend chart:', error);
  }
}

function getDateRange(timeRange) {
  const today = new Date();
  let dateFrom, dateTo;

  if (timeRange === '4weeks') {
    dateFrom = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    dateTo = today;
  } else if (timeRange === 'month') {
    dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    dateTo = today;
  } else if (timeRange === 'semester') {
    // Assume semester starts in January
    dateFrom = new Date(today.getFullYear(), 0, 1);
    dateTo = today;
  } else {
    dateFrom = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    dateTo = today;
  }

  return {
    dateFrom: dateFrom.toISOString().split('T')[0],
    dateTo: dateTo.toISOString().split('T')[0]
  };
}

function formatDateLabel(dateStr) {
  // Format "2025-W5" or "2025-01" to readable format
  if (dateStr.includes('W')) {
    const [, week] = dateStr.split('-W');
    return `Week ${week}`;
  } else if (dateStr.includes('-')) {
    const [year, month] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
  return dateStr;
}

// Load attendance by type (all types in one chart)
async function loadAttendanceByTypeChart(teamIdFilter) {
  try {
    const timeRangeEl = document.getElementById('typeTimeRange');
    if (!timeRangeEl) {
      console.warn('typeTimeRange element not found');
      return;
    }
    
    const timeRange = timeRangeEl.value;
    const { dateFrom, dateTo } = getDateRange(timeRange);
    
    let url = `/api/attendance/stats/by-type?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week`;
    if (teamIdFilter) {
      url += `&teamId=${teamIdFilter}`;
    }
    
    console.log('Loading attendance by type chart:', url);
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load attendance by type: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Attendance by type data:', data);
    
    if (!data || !data.types || data.types.length === 0) {
      console.warn('No attendance type data available');
      const canvas = document.getElementById('attendanceByTypeChart');
      if (canvas && attendanceByTypeChart) {
        attendanceByTypeChart.destroy();
        attendanceByTypeChart = null;
      }
      return;
    }
    
    const canvas = document.getElementById('attendanceByTypeChart');
    if (!canvas) {
      console.error('attendanceByTypeChart canvas not found');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (attendanceByTypeChart) {
      attendanceByTypeChart.destroy();
    }

    // Get all unique dates from all types
    const allDates = new Set();
    data.types.forEach(type => {
      if (type.data && Array.isArray(type.data)) {
        type.data.forEach(d => allDates.add(d.date));
      }
    });
    const labels = Array.from(allDates).sort().map(d => formatDateLabel(d));

    // Create datasets for each type
    const datasets = data.types.map((type, index) => {
      const dataMap = new Map();
      if (type.data && Array.isArray(type.data)) {
        type.data.forEach(d => dataMap.set(d.date, d.percentage));
      }
      return {
        label: type.typeLabel || type.type,
        data: labels.map(date => dataMap.get(date) || null),
        borderColor: `hsl(${220 + index * 60}, 70%, 50%)`,
        backgroundColor: `hsla(${220 + index * 60}, 70%, 50%, 0.1)`,
        tension: 0.4,
        fill: false
      };
    });

    attendanceByTypeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;
                return value !== null ? context.dataset.label + ': ' + value + '%' : context.dataset.label + ': No data';
              }
            }
          },
          legend: {
            display: true,
            position: 'bottom'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading attendance by type chart:', error);
  }
}

// Load class attendance trend
async function loadClassAttendanceChart(teamIdFilter) {
  if (classAttendanceChart) {
    classAttendanceChart.destroy();
  }
  classAttendanceChart = await loadTypeSpecificChart('class_attendance', 'classAttendanceChart', 'classAttendanceTimeRange', teamIdFilter);
}

// Load lecture notes trend
async function loadLectureChart(teamIdFilter) {
  if (lectureChart) {
    lectureChart.destroy();
  }
  lectureChart = await loadTypeSpecificChart('lecture', 'lectureChart', 'lectureTimeRange', teamIdFilter);
}

// Load meeting notes trend
async function loadMeetingChart(teamIdFilter) {
  if (meetingChart) {
    meetingChart.destroy();
  }
  meetingChart = await loadTypeSpecificChart('meeting', 'meetingChart', 'meetingTimeRange', teamIdFilter);
}

// Load office hours trend
async function loadOfficeHoursChart(teamIdFilter) {
  if (officeHoursChart) {
    officeHoursChart.destroy();
  }
  officeHoursChart = await loadTypeSpecificChart('office_hours', 'officeHoursChart', 'officeHoursTimeRange', teamIdFilter);
}

// Helper function to load a type-specific chart
async function loadTypeSpecificChart(type, canvasId, timeRangeId, teamIdFilter) {
  try {
    const timeRangeEl = document.getElementById(timeRangeId);
    if (!timeRangeEl) {
      console.warn(`${timeRangeId} element not found for ${type} chart`);
      return null;
    }
    
    const timeRange = timeRangeEl.value;
    const { dateFrom, dateTo } = getDateRange(timeRange);
    
    let url = `/api/attendance/stats/by-type?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week&type=${type}`;
    if (teamIdFilter) {
      url += `&teamId=${teamIdFilter}`;
    }
    
    console.log(`Loading ${type} chart:`, url);
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load ${type} chart: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`${type} chart data:`, data);
    
    const typeData = data.types && data.types.find(t => t.type === type);
    if (!typeData || !typeData.data || !Array.isArray(typeData.data) || typeData.data.length === 0) {
      console.warn(`No data available for ${type} chart`);
      return null;
    }
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`${canvasId} canvas not found`);
      return null;
    }
    
    const ctx = canvas.getContext('2d');
    
    const labels = typeData.data.map(d => formatDateLabel(d.date));
    const percentages = typeData.data.map(d => d.percentage || 0);
    
    const typeLabels = {
      'class_attendance': 'Class Attendance',
      'lecture': 'Lecture Notes',
      'meeting': 'Meeting Notes',
      'office_hours': 'Office Hours'
    };
    
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: typeLabels[type] || type,
          data: percentages,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return typeLabels[type] + ': ' + context.parsed.y + '%';
              }
            }
          },
          legend: {
            display: false
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error loading ${type} chart:`, error);
    return null;
  }
}

