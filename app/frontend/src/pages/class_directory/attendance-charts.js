/* global Chart */

let teamComparisonChart = null;
let teamTrendChart = null;
let classTrendChart = null;
let currentUserTeamId = null;
let allMembers = [];

// Make initAttendanceSection globally accessible for class_directory/script.js
window.initAttendanceSection = async function initAttendanceSection() {
  const role = localStorage.getItem('role');
  
  // Load user's team information
  try {
    const membersResponse = await fetch('/api/members');
    if (membersResponse.ok) {
      allMembers = await membersResponse.json();
      
      const firstName = localStorage.getItem('firstName');
      const lastName = localStorage.getItem('lastName');
      const userFullName = `${firstName || ''} ${lastName || ''}`.trim();
      
      if (role === 'student' || role === 'team_lead') {
        const currentUser = allMembers.find(m => 
          m.name.toLowerCase() === userFullName.toLowerCase() ||
          (firstName && lastName && m.name.toLowerCase().includes(firstName.toLowerCase()) && m.name.toLowerCase().includes(lastName.toLowerCase()))
        );
        
        if (currentUser && currentUser.teamId) {
          currentUserTeamId = currentUser.teamId;
        }
      }
    }

    // Teams are loaded as needed in individual functions
  } catch (error) {
    console.error('Error loading user data:', error);
  }

  if (role === 'professor' || role === 'Teaching Assistant') {
    const classOverviewSection = document.getElementById('classOverviewSection');
    if (classOverviewSection) {
      classOverviewSection.style.display = 'block';
    }
  }

  const teamIdFilter = (role === 'student' || role === 'team_lead') ? currentUserTeamId : null;
  
  loadAttendanceSummary(teamIdFilter);
  loadTeamComparison(teamIdFilter);
  loadTeamTrendChart(teamIdFilter);
  
  if (role === 'professor' || role === 'Teaching Assistant') {
    loadClassTrendChart(teamIdFilter);
  }

  // Setup event listeners
  const timeRangeFilter = document.getElementById('timeRangeFilter');
  if (timeRangeFilter) {
    timeRangeFilter.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = (role === 'student' || role === 'team_lead') ? currentUserTeamId : null;
      loadTeamTrendChart(teamIdFilter);
    });
  }

  const classTimeRangeFilter = document.getElementById('classTimeRangeFilter');
  if (classTimeRangeFilter) {
    classTimeRangeFilter.addEventListener('change', () => {
      const role = localStorage.getItem('role');
      const teamIdFilter = (role === 'student' || role === 'team_lead') ? currentUserTeamId : null;
      loadClassTrendChart(teamIdFilter);
    });
  }

  const markAttendanceBtn = document.getElementById('markAttendanceBtn');
  if (markAttendanceBtn) {
    markAttendanceBtn.addEventListener('click', () => {
      window.location.href = '/attendance/quick-entry.html';
    });
  }
}

async function loadAttendanceSummary(teamIdFilter) {
  try {
    const url = teamIdFilter 
      ? `/api/attendance/stats/summary?teamId=${teamIdFilter}`
      : '/api/attendance/stats/summary';
    const response = await fetch(url);
    if (!response.ok) return;
    
    const stats = await response.json();
    
    const classPercent = document.getElementById('classAttendancePercent');
    const weekPercent = document.getElementById('weekAttendancePercent');
    
    // For single team view, use team average; otherwise use class average
    const average = teamIdFilter && stats.teamComparison.length === 1
      ? stats.teamComparison[0].percentage
      : stats.classAverage;
    
    if (classPercent) {
      classPercent.textContent = `${average || 0}%`;
    }
    if (weekPercent) {
      weekPercent.textContent = `${average || 0}%`;
    }
  } catch (error) {
    console.error('Error loading attendance summary:', error);
  }
}

async function loadTeamComparison(teamIdFilter) {
  try {
    const url = teamIdFilter 
      ? `/api/attendance/stats/teams/current?teamId=${teamIdFilter}`
      : '/api/attendance/stats/teams/current';
    const response = await fetch(url);
    if (!response.ok) return;
    
    const data = await response.json();
    const canvas = document.getElementById('team-comparison-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (teamComparisonChart) {
      teamComparisonChart.destroy();
    }

    teamComparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.teamComparison.map(t => t.teamName),
        datasets: [{
          label: 'Attendance %',
          data: data.teamComparison.map(t => t.percentage),
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
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const timeRange = timeRangeFilter ? timeRangeFilter.value : '4weeks';
    const { dateFrom, dateTo } = getDateRange(timeRange);
    
    let url = `/api/attendance/stats/teams?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week`;
    if (teamIdFilter) {
      url += `&teamId=${teamIdFilter}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) return;
    
    const data = await response.json();
    const canvas = document.getElementById('team-trend-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (teamTrendChart) {
      teamTrendChart.destroy();
    }

    const datasets = data.teams.map((team, index) => ({
      label: team.teamName,
      data: team.data.map(d => d.percentage),
      borderColor: `hsl(${220 + index * 30}, 70%, 50%)`,
      backgroundColor: `hsla(${220 + index * 30}, 70%, 50%, 0.1)`,
      tension: 0.4,
      fill: false
    }));

    const labels = data.teams.length > 0 && data.teams[0].data.length > 0
      ? data.teams[0].data.map(d => formatDateLabel(d.date))
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
    const classTimeRangeFilter = document.getElementById('classTimeRangeFilter');
    const timeRange = classTimeRangeFilter ? classTimeRangeFilter.value : '4weeks';
    const { dateFrom, dateTo } = getDateRange(timeRange);
    
    // If filtering by team, use team stats instead
    let url;
    if (teamIdFilter) {
      url = `/api/attendance/stats/teams?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week&teamId=${teamIdFilter}`;
      const response = await fetch(url);
      if (!response.ok) return;
      const data = await response.json();
      
      // Use team data for class chart when filtered
      if (data.teams && data.teams.length > 0) {
        const team = data.teams[0];
        const canvas = document.getElementById('class-trend-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
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
    
    url = `/api/attendance/stats/class?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=week`;
    const response = await fetch(url);
    if (!response.ok) return;
    
    const data = await response.json();
    const canvas = document.getElementById('class-trend-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (classTrendChart) {
      classTrendChart.destroy();
    }

    const labels = data.classAverage.map(d => formatDateLabel(d.date));
    const percentages = data.classAverage.map(d => d.percentage);

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

