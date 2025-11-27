/* global fetch */

let allMembers = [];
let allTeams = [];
let currentUser = null;
let existingRecord = null;

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
  setupEventListeners();
});

function initializePage() {
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('attendanceDate').value = today;

  // Get current user from localStorage
  const role = localStorage.getItem('role');
  const firstName = localStorage.getItem('firstName');
  const lastName = localStorage.getItem('lastName');
  const email = localStorage.getItem('email');
  
  currentUser = {
    role,
    name: `${firstName || ''} ${lastName || ''}`.trim(),
    email: email || ''
  };

  // Update label based on role
  const studentsLabel = document.getElementById('studentsLabel');
  if (role === 'student') {
    studentsLabel.textContent = 'Your Attendance *';
    // Hide quick actions for students
    document.querySelector('.quick-actions').style.display = 'none';
  } else if (role === 'team_lead') {
    studentsLabel.textContent = 'Team Members *';
  } else {
    studentsLabel.textContent = 'Students *';
  }

  // Load members and teams
  loadMembers();
  loadTeams();
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

  // Type change handler
  document.getElementById('attendanceType').addEventListener('change', (e) => {
    const type = e.target.value;
    const titleGroup = document.getElementById('titleGroup');
    const notesGroup = document.getElementById('notesGroup');
    const timeGroup = document.getElementById('timeGroup');

    if (type === 'class_attendance') {
      titleGroup.style.display = 'none';
      notesGroup.style.display = 'none';
      timeGroup.style.display = 'none';
    } else {
      titleGroup.style.display = 'flex';
      notesGroup.style.display = 'flex';
      if (type === 'office_hours') {
        timeGroup.style.display = 'flex';
      } else {
        timeGroup.style.display = 'none';
      }
    }
  });

  // Quick action buttons
  document.getElementById('markAllPresent').addEventListener('click', () => {
    document.querySelectorAll('.status-select').forEach(select => {
      select.value = 'present';
    });
  });

  document.getElementById('markAllAbsent').addEventListener('click', () => {
    document.querySelectorAll('.status-select').forEach(select => {
      select.value = 'absent';
    });
  });

  // Form submission
  document.getElementById('attendanceForm').addEventListener('submit', handleSubmit);
  
  // Update button
  document.getElementById('updateBtn').addEventListener('click', handleUpdate);
}

async function loadMembers() {
  try {
    const response = await fetch('/api/members');
    if (!response.ok) throw new Error('Failed to load members');
    allMembers = await response.json();
    renderStudentsList();
  } catch (error) {
    console.error('Error loading members:', error);
    showMessage('Failed to load members', 'error');
  }
}

async function loadTeams() {
  try {
    const response = await fetch('/api/teams');
    if (!response.ok) throw new Error('Failed to load teams');
    allTeams = await response.json();
  } catch (error) {
    console.error('Error loading teams:', error);
  }
}

function renderStudentsList() {
  const container = document.getElementById('studentsList');
  container.innerHTML = '';

  const role = localStorage.getItem('role');
  const firstName = localStorage.getItem('firstName');
  const lastName = localStorage.getItem('lastName');
  const userFullName = `${firstName || ''} ${lastName || ''}`.trim();

  // Students can only mark their own attendance
  if (role === 'student') {
    // Find current user in members list - try multiple matching strategies
    let currentUserMember = null;
    
    // Strategy 1: Exact match (case insensitive)
    if (userFullName) {
      currentUserMember = allMembers.find(m => 
        m.name.toLowerCase().trim() === userFullName.toLowerCase().trim()
      );
    }

    // Strategy 2: Partial match with first and last name
    if (!currentUserMember && firstName && lastName) {
      currentUserMember = allMembers.find(m => {
        const memberName = m.name.toLowerCase();
        const firstLower = firstName.toLowerCase();
        const lastLower = lastName.toLowerCase();
        // Check if member name contains both first and last name
        return memberName.includes(firstLower) && memberName.includes(lastLower);
      });
    }

    // Strategy 3: Match by first name only (if unique or best match)
    if (!currentUserMember && firstName) {
      const matches = allMembers.filter(m => 
        m.name.toLowerCase().includes(firstName.toLowerCase())
      );
      if (matches.length === 1) {
        currentUserMember = matches[0];
      }
    }

    if (!currentUserMember) {
      const errorDiv = document.createElement('div');
      errorDiv.style.padding = '20px';
      errorDiv.style.textAlign = 'center';
      
      const errorMsg = document.createElement('p');
      errorMsg.style.color = '#d00';
      errorMsg.style.marginBottom = '8px';
      errorMsg.textContent = 'Unable to find your student record.';
      
      const nameMsg = document.createElement('p');
      nameMsg.style.color = '#666';
      nameMsg.style.fontSize = '13px';
      nameMsg.textContent = `Your name: ${userFullName || 'Not provided'}`;
      
      const helpMsg = document.createElement('p');
      helpMsg.style.color = '#666';
      helpMsg.style.fontSize = '13px';
      helpMsg.textContent = 'Please ensure your name matches the class roster or contact support.';
      
      errorDiv.appendChild(errorMsg);
      errorDiv.appendChild(nameMsg);
      errorDiv.appendChild(helpMsg);
      container.innerHTML = '';
      container.appendChild(errorDiv);
      return;
    }

    // Show only the current student
    const studentItem = document.createElement('div');
    studentItem.className = 'student-item';
    
    // Use teamId from member record
    const teamId = currentUserMember.teamId || 1;
    const team = allTeams.find(t => t.id === teamId) || { name: `Team ${teamId}`, id: teamId };

    // Create elements safely without innerHTML
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'student-checkbox';
    checkbox.dataset.memberId = String(currentUserMember.id);
    checkbox.checked = true;
    checkbox.disabled = true;
    
    const studentInfo = document.createElement('div');
    studentInfo.className = 'student-info';
    
    const studentName = document.createElement('span');
    studentName.className = 'student-name';
    studentName.textContent = `${currentUserMember.name} (You)`;
    
    const studentTeam = document.createElement('span');
    studentTeam.className = 'student-team';
    studentTeam.textContent = team.name || `Team ${teamId}`;
    
    studentInfo.appendChild(studentName);
    studentInfo.appendChild(studentTeam);
    
    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select';
    statusSelect.dataset.memberId = String(currentUserMember.id);
    
    ['present', 'absent', 'late', 'excused'].forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusSelect.appendChild(option);
    });
    
    studentItem.appendChild(checkbox);
    studentItem.appendChild(studentInfo);
    studentItem.appendChild(statusSelect);
    container.appendChild(studentItem);
    return;
  }

  // Team leads can mark attendance for their team
  if (role === 'team_lead') {
    // Find current user's team using teamId from members.json
    let currentUserMember = null;
    
    // Strategy 1: Exact match
    if (userFullName) {
      currentUserMember = allMembers.find(m => 
        m.name.toLowerCase().trim() === userFullName.toLowerCase().trim()
      );
    }

    // Strategy 2: Partial match
    if (!currentUserMember && firstName && lastName) {
      currentUserMember = allMembers.find(m => {
        const memberName = m.name.toLowerCase();
        return memberName.includes(firstName.toLowerCase()) && memberName.includes(lastName.toLowerCase());
      });
    }

    if (!currentUserMember) {
      const errorDiv = document.createElement('div');
      errorDiv.style.padding = '20px';
      errorDiv.style.textAlign = 'center';
      
      const errorMsg = document.createElement('p');
      errorMsg.style.color = '#d00';
      errorMsg.style.marginBottom = '8px';
      errorMsg.textContent = 'Unable to find your team lead record.';
      
      const nameMsg = document.createElement('p');
      nameMsg.style.color = '#666';
      nameMsg.style.fontSize = '13px';
      nameMsg.textContent = `Your name: ${userFullName || 'Not provided'}`;
      
      errorDiv.appendChild(errorMsg);
      errorDiv.appendChild(nameMsg);
      container.innerHTML = '';
      container.appendChild(errorDiv);
      return;
    }

    // Get teamId from member record
    const teamId = currentUserMember.teamId;
    
    if (!teamId) {
      const noTeamMsg = document.createElement('p');
      noTeamMsg.style.padding = '20px';
      noTeamMsg.style.textAlign = 'center';
      noTeamMsg.style.color = '#666';
      noTeamMsg.textContent = 'You are not assigned to a team.';
      container.innerHTML = '';
      container.appendChild(noTeamMsg);
      return;
    }

    // Find team by teamId
    const userTeam = allTeams.find(t => t.id === teamId);
    const teamName = userTeam ? userTeam.name : `Team ${teamId}`;

    // Show all team members (including the team lead themselves) by filtering by teamId
    const teamMembers = allMembers.filter(m => m.teamId === teamId);

    if (teamMembers.length === 0) {
      const noMembersMsg = document.createElement('p');
      noMembersMsg.style.padding = '20px';
      noMembersMsg.style.textAlign = 'center';
      noMembersMsg.style.color = '#666';
      noMembersMsg.textContent = 'No team members found for your team.';
      container.innerHTML = '';
      container.appendChild(noMembersMsg);
      return;
    }

    teamMembers.forEach(member => {
      const studentItem = document.createElement('div');
      studentItem.className = 'student-item';
      
      // Mark team lead with "(You)" label
      const isTeamLead = member.id === currentUserMember.id;
      
      // Create elements safely without innerHTML
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'student-checkbox';
      checkbox.dataset.memberId = String(member.id);
      checkbox.checked = true;
      
      const studentInfo = document.createElement('div');
      studentInfo.className = 'student-info';
      
      const studentName = document.createElement('span');
      studentName.className = 'student-name';
      studentName.textContent = `${member.name}${isTeamLead ? ' (You)' : ''}`;
      
      const studentTeam = document.createElement('span');
      studentTeam.className = 'student-team';
      studentTeam.textContent = teamName;
      
      studentInfo.appendChild(studentName);
      studentInfo.appendChild(studentTeam);
      
      const statusSelect = document.createElement('select');
      statusSelect.className = 'status-select';
      statusSelect.dataset.memberId = String(member.id);
      
      ['present', 'absent', 'late', 'excused'].forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        statusSelect.appendChild(option);
      });
      
      studentItem.appendChild(checkbox);
      studentItem.appendChild(studentInfo);
      studentItem.appendChild(statusSelect);

      container.appendChild(studentItem);
    });
    return;
  }

  // Professor/TA can mark attendance for all students
  allMembers.forEach(member => {
    const studentItem = document.createElement('div');
    studentItem.className = 'student-item';
    
    const team = allTeams.find(t => t.members?.includes(member.initials)) || { name: 'No Team', id: null };

    studentItem.innerHTML = `
      <input type="checkbox" class="student-checkbox" data-member-id="${member.id}" checked>
      <div class="student-info">
        <span class="student-name">${member.name}</span>
        <span class="student-team">${team.name || 'No Team'}</span>
      </div>
      <select class="status-select" data-member-id="${member.id}">
        <option value="present">Present</option>
        <option value="absent">Absent</option>
        <option value="late">Late</option>
        <option value="excused">Excused</option>
      </select>
    `;

    container.appendChild(studentItem);
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const type = formData.get('type');
  const date = formData.get('date');
  const title = formData.get('title');
  const time = formData.get('time');
  const notes = formData.get('notes');

  // Collect attendees
  const attendees = [];
  const role = localStorage.getItem('role');
  
  // For students, always include them (checkbox is disabled but checked)
  // Their information is automatically populated from members.json
  if (role === 'student') {
    const firstName = localStorage.getItem('firstName');
    const lastName = localStorage.getItem('lastName');
    const userFullName = `${firstName || ''} ${lastName || ''}`.trim();
    
    // Use the same matching logic as renderStudentsList
    let currentUserMember = null;
    
    // Strategy 1: Exact match
    if (userFullName) {
      currentUserMember = allMembers.find(m => 
        m.name.toLowerCase().trim() === userFullName.toLowerCase().trim()
      );
    }

    // Strategy 2: Partial match
    if (!currentUserMember && firstName && lastName) {
      currentUserMember = allMembers.find(m => {
        const memberName = m.name.toLowerCase();
        return memberName.includes(firstName.toLowerCase()) && memberName.includes(lastName.toLowerCase());
      });
    }

    // Strategy 3: First name only (if unique)
    if (!currentUserMember && firstName) {
      const matches = allMembers.filter(m => 
        m.name.toLowerCase().includes(firstName.toLowerCase())
      );
      if (matches.length === 1) {
        currentUserMember = matches[0];
      }
    }
    
    if (currentUserMember) {
      // Get status from the select dropdown (defaults to 'present' if not found)
      const statusSelect = document.querySelector(`.status-select[data-member-id="${currentUserMember.id}"]`);
      const status = statusSelect ? statusSelect.value : 'present';
      
      // Use teamId from member record (assigned by TA/professor)
      const teamId = currentUserMember.teamId || 1; // Default to 1 if not set
      const team = allTeams.find(t => t.id === teamId) || { id: teamId, name: `Team ${teamId}` };
      
      // Automatically use student's information - no manual entry needed
      attendees.push({
        memberId: currentUserMember.id,
        name: currentUserMember.name, // Use name from members.json, not from localStorage
        status: status,
        teamId: teamId,
        teamName: team.name || `Team ${teamId}`
      });
    }
  } else if (role === 'team_lead') {
    // For team leads, collect from checkboxes (all should be from their team)
    const firstName = localStorage.getItem('firstName');
    const lastName = localStorage.getItem('lastName');
    const userFullName = `${firstName || ''} ${lastName || ''}`.trim();
    
    // Find team lead's teamId
    let currentUserMember = allMembers.find(m => 
      m.name.toLowerCase().trim() === userFullName.toLowerCase().trim()
    );
    
    if (!currentUserMember && firstName && lastName) {
      currentUserMember = allMembers.find(m => {
        const memberName = m.name.toLowerCase();
        return memberName.includes(firstName.toLowerCase()) && memberName.includes(lastName.toLowerCase());
      });
    }
    
    const teamId = currentUserMember?.teamId;
    
    document.querySelectorAll('.student-checkbox:checked').forEach(checkbox => {
      const memberId = parseInt(checkbox.dataset.memberId, 10);
      const member = allMembers.find(m => m.id === memberId);
      
      // Only include members from the team lead's team
      if (member && member.teamId === teamId) {
        const statusSelect = document.querySelector(`.status-select[data-member-id="${memberId}"]`);
        const status = statusSelect.value;
        const team = allTeams.find(t => t.id === teamId) || { id: teamId, name: `Team ${teamId}` };

        attendees.push({
          memberId: member.id,
          name: member.name,
          status: status,
          teamId: teamId,
          teamName: team.name || `Team ${teamId}`
        });
      }
    });
  } else {
    // For professors/TAs, collect from checkboxes
    document.querySelectorAll('.student-checkbox:checked').forEach(checkbox => {
      const memberId = parseInt(checkbox.dataset.memberId, 10);
      const member = allMembers.find(m => m.id === memberId);
      const statusSelect = document.querySelector(`.status-select[data-member-id="${memberId}"]`);
      const status = statusSelect.value;

      // Use teamId from member record (assigned by TA/professor)
      const memberTeamId = member.teamId || 1;
      const team = allTeams.find(t => t.id === memberTeamId) || { id: memberTeamId, name: `Team ${memberTeamId}` };

      attendees.push({
        memberId: member.id,
        name: member.name,
        status: status,
        teamId: memberTeamId,
        teamName: team.name || `Team ${memberTeamId}`
      });
    });
  }

  // For students, we should always have at least themselves
  // For others, require at least one selection
  if (attendees.length === 0) {
    if (role === 'student') {
      showMessage('Unable to find your student record. Please contact support.', 'error');
    } else {
      showMessage('Please select at least one student', 'error');
    }
    return;
  }

  const attendanceData = {
    type,
    date,
    title: type !== 'class_attendance' ? title : null,
    time: type === 'office_hours' ? time : null,
    notes: type !== 'class_attendance' ? notes : null,
    attendees,
    createdBy: {
      name: currentUser.name || attendees[0]?.name || 'Unknown',
      email: currentUser.email || '',
      role: currentUser.role || 'student'
    }
  };

  try {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save attendance');
    }

    showMessage('Attendance saved successfully!', 'success');
    
    // Reset form for next entry (don't redirect)
    document.getElementById('attendanceForm').reset();
    document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
    
    // Reload the student list to show updated state
    renderStudentsList();
  } catch (error) {
    console.error('Error saving attendance:', error);
    showMessage(error.message || 'Failed to save attendance', 'error');
  }
}

async function handleUpdate() {
  if (!existingRecord) return;

  const formData = new FormData(document.getElementById('attendanceForm'));
  const notes = formData.get('notes');
  const title = formData.get('title');
  const time = formData.get('time');

  const role = localStorage.getItem('role');
  const firstName = localStorage.getItem('firstName');
  const lastName = localStorage.getItem('lastName');
  const userFullName = `${firstName || ''} ${lastName || ''}`.trim();

  // Collect updated attendees
  const attendees = [];
  
  // For students, always include them
  if (role === 'student') {
    const currentUserMember = allMembers.find(m => 
      m.name.toLowerCase() === userFullName.toLowerCase() ||
      (m.name.includes(firstName) && m.name.includes(lastName))
    );
    
    if (currentUserMember) {
      const statusSelect = document.querySelector(`.status-select[data-member-id="${currentUserMember.id}"]`);
      const status = statusSelect.value;
      const team = allTeams.find(t => t.members?.includes(currentUserMember.initials)) || { id: null, name: 'No Team' };
      
      attendees.push({
        memberId: currentUserMember.id,
        name: currentUserMember.name,
        status: status,
        teamId: team.id || null,
        teamName: team.name || 'No Team'
      });
    }
  } else if (role === 'team_lead') {
    // For team leads, collect from checkboxes (all should be from their team)
    let currentUserMember = allMembers.find(m => 
      m.name.toLowerCase().trim() === userFullName.toLowerCase().trim()
    );
    
    if (!currentUserMember && firstName && lastName) {
      currentUserMember = allMembers.find(m => {
        const memberName = m.name.toLowerCase();
        return memberName.includes(firstName.toLowerCase()) && memberName.includes(lastName.toLowerCase());
      });
    }
    
    const teamId = currentUserMember?.teamId;
    
    document.querySelectorAll('.student-checkbox:checked').forEach(checkbox => {
      const memberId = parseInt(checkbox.dataset.memberId, 10);
      const member = allMembers.find(m => m.id === memberId);
      
      // Only include members from the team lead's team
      if (member && member.teamId === teamId) {
        const statusSelect = document.querySelector(`.status-select[data-member-id="${memberId}"]`);
        const status = statusSelect.value;
        const team = allTeams.find(t => t.id === teamId) || { id: teamId, name: `Team ${teamId}` };

        attendees.push({
          memberId: member.id,
          name: member.name,
          status: status,
          teamId: teamId,
          teamName: team.name || `Team ${teamId}`
        });
      }
    });
  } else {
    // For professors/TAs, collect from checkboxes
    document.querySelectorAll('.student-checkbox:checked').forEach(checkbox => {
      const memberId = parseInt(checkbox.dataset.memberId, 10);
      const member = allMembers.find(m => m.id === memberId);
      const statusSelect = document.querySelector(`.status-select[data-member-id="${memberId}"]`);
      const status = statusSelect.value;

      // Use teamId from member record
      const memberTeamId = member.teamId || 1;
      const team = allTeams.find(t => t.id === memberTeamId) || { id: memberTeamId, name: `Team ${memberTeamId}` };

      attendees.push({
        memberId: member.id,
        name: member.name,
        status: status,
        teamId: memberTeamId,
        teamName: team.name || `Team ${memberTeamId}`
      });
    });
  }

  try {
    const response = await fetch(`/api/attendance/${existingRecord.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendees,
        notes: existingRecord.type !== 'class_attendance' ? notes : null,
        title: existingRecord.type !== 'class_attendance' ? title : null,
        time: existingRecord.type === 'office_hours' ? time : null
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update attendance');
    }

    showMessage('Attendance updated successfully!', 'success');
    
    // Reset form for next entry (don't redirect)
    document.getElementById('attendanceForm').reset();
    document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
    
    // Reload the student list to show updated state
    renderStudentsList();
  } catch (error) {
    console.error('Error updating attendance:', error);
    showMessage(error.message || 'Failed to update attendance', 'error');
  }
}

function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

