/* global fetch */

let allRecords = [];
let allTeams = [];
let allMembers = [];
let currentUserTeamId = null;
let currentUserEmail = null;
let currentUserName = null;
let userRole = null;

// Helper function to check if user is TA or Professor
function isTAOrProfessor(role) {
  if (!role) return false;
  const roleLower = role.toLowerCase();
  return roleLower === 'professor' || roleLower === 'teaching assistant';
}

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
  setupEventListeners();
  loadUserData();
});

async function initializePage() {
  userRole = localStorage.getItem('role');
  currentUserEmail = localStorage.getItem('email');
  const firstName = localStorage.getItem('firstName');
  const lastName = localStorage.getItem('lastName');
  currentUserName = `${firstName || ''} ${lastName || ''}`.trim();

  // Show team filter for professors/TAs
  if (isTAOrProfessor(userRole)) {
    const teamFilterGroup = document.getElementById('teamFilterGroup');
    if (teamFilterGroup) {
      teamFilterGroup.style.display = 'flex';
    }
  }
}

async function loadUserData() {
  try {
    // Load teams
    const teamsResponse = await fetch('/api/teams');
    if (teamsResponse.ok) {
      allTeams = await teamsResponse.json();
      
      // Populate team filter for professors/TAs
      if (isTAOrProfessor(userRole)) {
        const teamFilter = document.getElementById('teamFilter');
        if (teamFilter) {
          allTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name || `Team ${team.id}`;
            teamFilter.appendChild(option);
          });
        }
      }
    }

    // Load members to get current user's teamId
    const membersResponse = await fetch('/api/members');
    if (membersResponse.ok) {
      allMembers = await membersResponse.json();
      
      if (userRole === 'student' || userRole === 'team_lead') {
        // Try multiple matching strategies
        let currentUser = allMembers.find(m => 
          m.name.toLowerCase().trim() === currentUserName.toLowerCase().trim()
        );
        
        // Try email match if name match fails
        if (!currentUser && currentUserEmail) {
          currentUser = allMembers.find(m => m.email && m.email.toLowerCase() === currentUserEmail.toLowerCase());
        }
        
        // Try partial name match
        if (!currentUser && currentUserName) {
          const firstName = localStorage.getItem('firstName');
          const lastName = localStorage.getItem('lastName');
          if (firstName && lastName) {
            currentUser = allMembers.find(m => {
              const memberName = m.name.toLowerCase();
              return memberName.includes(firstName.toLowerCase()) && memberName.includes(lastName.toLowerCase());
            });
          }
        }
        
        if (currentUser && currentUser.teamId) {
          currentUserTeamId = currentUser.teamId;
        }
      }
    }

    loadHistory();
  } catch (error) {
    console.error('Error loading user data:', error);
    loadHistory();
  }
}

function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    const role = localStorage.getItem('role');
    const roleLower = role ? role.toLowerCase() : '';
    if (roleLower === 'professor') {
      window.location.href = '/dashboards/professor.html';
    } else if (roleLower === 'teaching assistant' || role === 'Teaching Assistant') {
      window.location.href = '/dashboards/ta.html';
    } else if (role === 'team_lead') {
      window.location.href = '/dashboards/team_lead.html';
    } else {
      window.location.href = '/dashboards/student.html';
    }
  });

  // Filter listeners
  document.getElementById('typeFilter').addEventListener('change', () => {
    renderHistory(allRecords);
  });

  const teamFilter = document.getElementById('teamFilter');
  if (teamFilter) {
    teamFilter.addEventListener('change', () => {
      renderHistory(allRecords);
    });
  }

  // Modal listeners
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelEdit').addEventListener('click', closeModal);
  document.getElementById('editForm').addEventListener('submit', handleEditSubmit);

  // Close modal on outside click
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
      closeModal();
    }
  });
}

async function loadHistory() {
  try {
    // Always load all records first, then filter in frontend
    // This allows better control over filtering logic
    // For TA/professor, load all records (no backend filtering)
    // For students/team leads, backend can filter by teamId if needed
    const response = await fetch('/api/attendance');
    if (!response.ok) {
      throw new Error(`Failed to load history: ${response.status} ${response.statusText}`);
    }
    
    allRecords = await response.json();
    
    // Debug logging
    console.log('Loaded records:', allRecords?.length || 0);
    console.log('User role:', userRole);
    
    // If no records, show message
    if (!allRecords || allRecords.length === 0) {
      const container = document.getElementById('historyList');
      if (container) {
        container.innerHTML = 
          '<p style="padding: 20px; text-align: center; color: #666;">No attendance records yet.</p>';
      }
      return;
    }
    
    renderHistory(allRecords);
  } catch (error) {
    console.error('Error loading history:', error);
    const container = document.getElementById('historyList');
    if (container) {
      container.innerHTML = 
        '<p style="padding: 20px; text-align: center; color: #d00;">Failed to load attendance history. Please try again.</p>';
    }
  }
}

function renderHistory(records) {
  const container = document.getElementById('historyList');
  
  if (!container) {
    console.error('History list container not found');
    return;
  }
  
  // Debug: Log role and records
  console.log('renderHistory - User role:', userRole);
  console.log('renderHistory - Total records:', records.length);
  console.log('renderHistory - Records:', records);
  
  // Apply filters
  let filtered = [...records];
  
  // Type filter
  const typeFilterEl = document.getElementById('typeFilter');
  if (typeFilterEl) {
    const typeFilter = typeFilterEl.value;
    console.log('Type filter value:', typeFilter);
    if (typeFilter) {
      filtered = filtered.filter(r => r.type === typeFilter);
      console.log('After type filter:', filtered.length);
    }
  }
  
  // Team filter (for professors/TAs) - if no team selected, show all records
  if (isTAOrProfessor(userRole)) {
    const teamFilter = document.getElementById('teamFilter');
    if (teamFilter && teamFilter.value) {
      const teamId = parseInt(teamFilter.value, 10);
      filtered = filtered.filter(r => 
        r.attendees && Array.isArray(r.attendees) && r.attendees.some(a => a && a.teamId === teamId)
      );
      console.log('After team filter:', filtered.length);
    }
    // If no team filter selected, show all records (no additional filtering needed)
  }
  
  // For students/team leads, only show records from their team
  // Also show records they created (even if teamId doesn't match)
  if (userRole === 'student' || userRole === 'team_lead') {
    if (currentUserTeamId) {
      filtered = filtered.filter(r => {
        // Ensure attendees array exists
        if (!r.attendees || !Array.isArray(r.attendees)) {
          return false;
        }
        // Show if record has attendees from user's team
        const hasTeamMembers = r.attendees.some(a => a && a.teamId === currentUserTeamId);
        // OR if user created this record
        const isCreator = (currentUserEmail && r.createdBy?.email === currentUserEmail) || 
                         (currentUserName && r.createdBy?.name?.toLowerCase() === currentUserName.toLowerCase());
        return hasTeamMembers || isCreator;
      });
    } else {
      // If no teamId, only show records created by user
      filtered = filtered.filter(r => {
        const isCreator = (currentUserEmail && r.createdBy?.email === currentUserEmail) || 
                         (currentUserName && r.createdBy?.name?.toLowerCase() === currentUserName.toLowerCase());
        return isCreator;
      });
    }
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No attendance records found.</p>';
    return;
  }

  // Debug logging for TA/professor
  if (isTAOrProfessor(userRole)) {
    console.log('TA/Professor view - Total records:', records.length);
    console.log('After type filter:', filtered.length);
    console.log('Filtered records:', filtered);
    console.log('User role:', userRole);
  }

  // Sort by date (newest first)
  const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = sorted.map(record => {
    const date = new Date(record.date).toLocaleDateString();
    const typeLabels = {
      'class_attendance': 'Class Attendance',
      'lecture': 'Lecture Notes',
      'meeting': 'Meeting Notes',
      'office_hours': 'Office Hours'
    };
    
    // Check if current user created this record (for students/team leads)
    const isCreator = (userRole === 'student' || userRole === 'team_lead') && 
      (record.createdBy?.email === currentUserEmail || 
       record.createdBy?.name?.toLowerCase() === currentUserName.toLowerCase());
    
    const canEdit = isCreator && (record.type !== 'class_attendance');
    
    // For TA/Professor: limited view (type, date, author only - NO content/notes)
    if (isTAOrProfessor(userRole)) {
      // Get unique teams from attendees (handle null/undefined)
      const teams = record.attendees && Array.isArray(record.attendees)
        ? [...new Set(record.attendees.map(a => a && a.teamId).filter(id => id !== null && id !== undefined))]
        : [];
      const teamNames = teams.map(teamId => {
        const team = allTeams.find(t => t.id === teamId);
        return team ? team.name : `Team ${teamId}`;
      }).join(', ');
      
      // Format date nicely
      const dateStr = new Date(record.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Build display info with proper escaping
      const typeLabel = escapeHtml(typeLabels[record.type] || record.type);
      const escapedDateStr = escapeHtml(dateStr);
      const escapedTime = record.time ? escapeHtml(record.time) : '';
      const escapedCreator = escapeHtml(record.createdBy?.name || 'Unknown');
      const escapedTeamNames = teamNames ? escapeHtml(teamNames) : '';
      const createdAtStr = new Date(record.createdAt).toLocaleString();
      
      return `
        <div class="history-item limited-view">
          <div class="history-item-header">
            <div class="history-item-info">
              <h3 class="history-item-title">${typeLabel}</h3>
              <div style="margin-top: 8px;">
                <p class="history-item-meta" style="margin: 4px 0;"><strong>Type:</strong> ${typeLabel}</p>
                <p class="history-item-meta" style="margin: 4px 0;"><strong>Date:</strong> ${escapedDateStr}${escapedTime ? ' at ' + escapedTime : ''}</p>
                <p class="history-item-meta" style="margin: 4px 0;"><strong>Created by:</strong> ${escapedCreator}</p>
                ${escapedTeamNames ? `<p class="history-item-meta" style="margin: 4px 0;"><strong>Team(s):</strong> ${escapedTeamNames}</p>` : ''}
              </div>
            </div>
          </div>
          <div class="history-item-footer">
            <span style="font-size: 11px; color: #9ca3af;">Created: ${escapeHtml(createdAtStr)}</span>
          </div>
        </div>
      `;
    }
    
    // For students/team leads: full view with edit capability
    const presentCount = record.attendees ? record.attendees.filter(a => a.status === 'present').length : 0;
    const totalCount = record.attendees ? record.attendees.length : 0;
    const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
    
    // Get team name(s)
    const teamIds = record.attendees ? [...new Set(record.attendees.map(a => a.teamId).filter(id => id !== null && id !== undefined))] : [];
    let teamName = 'No Team';
    if (teamIds.length > 0) {
      const team = allTeams.find(t => t.id === teamIds[0]);
      teamName = team ? team.name : `Team ${teamIds[0]}`;
      if (teamIds.length > 1) {
        teamName += ` (+${teamIds.length - 1} more)`;
      }
    }

    // Escape record.id to prevent XSS
    const escapedRecordId = escapeHtml(record.id);
    const onClickAttr = canEdit ? `onclick="openEditModal('${escapedRecordId}')"` : '';
    
    // Escape all user-provided data
    const escapedType = escapeHtml(typeLabels[record.type] || record.type);
    const escapedDate = escapeHtml(date);
    const escapedTime = record.time ? escapeHtml(record.time) : '';
    const escapedTitle = record.title ? escapeHtml(record.title) : '';
    const escapedTeamName = escapeHtml(teamName);
    
    return `
      <div class="history-item ${canEdit ? 'editable' : ''}" data-record-id="${escapedRecordId}" ${onClickAttr}>
        <div class="history-item-header">
          <div class="history-item-info">
            <h3 class="history-item-title">
              ${escapedType}
              ${canEdit ? '<span class="edit-badge">Click to edit</span>' : ''}
            </h3>
            <p class="history-item-meta">${escapedDate}${escapedTime ? ' at ' + escapedTime : ''}</p>
            ${escapedTitle ? `<p class="history-item-meta" style="margin-top: 4px;">${escapedTitle}</p>` : ''}
            <p class="history-item-meta" style="margin-top: 4px;">Team: ${escapedTeamName}</p>
          </div>
          <div class="history-item-stats">
            <p class="history-item-percentage">${percentage}%</p>
            <p class="history-item-count">${presentCount}/${totalCount} present</p>
          </div>
        </div>
        ${record.notes ? `<div class="history-item-notes">${escapeHtml(record.notes)}</div>` : ''}
        <div class="history-item-footer">
          <div class="history-item-author">
            <span>Created by: <strong>${escapeHtml(record.createdBy?.name || 'Unknown')}</strong></span>
            ${isCreator ? '<span class="edit-badge">Your record</span>' : ''}
          </div>
          <span>${new Date(record.createdAt).toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make openEditModal globally accessible
window.openEditModal = function(recordId) {
  const record = allRecords.find(r => r.id === recordId);
  if (!record) return;
  
  // Check if user can edit (must be creator and not class_attendance)
  const isCreator = (record.createdBy?.email === currentUserEmail || 
    record.createdBy?.name?.toLowerCase() === currentUserName.toLowerCase());
  
  if (!isCreator || record.type === 'class_attendance') {
    return;
  }
  
  document.getElementById('editRecordId').value = record.id;
  document.getElementById('editTitle').value = record.title || '';
  document.getElementById('editNotes').value = record.notes || '';
  document.getElementById('editTime').value = record.time || '';
  
  // Show/hide time field based on type
  const timeGroup = document.getElementById('editTimeGroup');
  if (timeGroup) {
    timeGroup.style.display = record.type === 'office_hours' ? 'flex' : 'none';
  }
  
  document.getElementById('editModal').style.display = 'flex';
};

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editForm').reset();
}

async function handleEditSubmit(e) {
  e.preventDefault();
  
  const recordId = document.getElementById('editRecordId').value;
  const title = document.getElementById('editTitle').value.trim();
  const notes = document.getElementById('editNotes').value.trim();
  const time = document.getElementById('editTime').value;
  
  try {
    const record = allRecords.find(r => r.id === recordId);
    if (!record) {
      throw new Error('Record not found');
    }
    
    // Only allow updating notes, title, and time (not attendees)
    const updates = {};
    if (record.type !== 'class_attendance') {
      updates.title = title || null;
      updates.notes = notes || null;
      if (record.type === 'office_hours') {
        updates.time = time || null;
      }
    }
    
    const response = await fetch(`/api/attendance/${recordId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update record');
    }
    
    const updated = await response.json();
    
    // Update local record
    const index = allRecords.findIndex(r => r.id === recordId);
    if (index !== -1) {
      allRecords[index] = updated;
    }
    
    closeModal();
    renderHistory(allRecords);
    
    // Show success message
    showMessage('Attendance record updated successfully!', 'success');
  } catch (error) {
    console.error('Error updating record:', error);
    showMessage(error.message || 'Failed to update record', 'error');
  }
}

function showMessage(text, type) {
  // Create or update message element
  let messageEl = document.getElementById('message');
  if (!messageEl) {
    messageEl = document.createElement('div');
    messageEl.id = 'message';
    messageEl.className = 'message';
    document.body.appendChild(messageEl);
  }
  
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}
