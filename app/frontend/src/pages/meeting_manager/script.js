const attendanceList = document.getElementById('attendanceList');
const agendaContainer = document.getElementById('agendaContainer');
const discussionContainer = document.getElementById('discussionContainer');
const actionContainer = document.getElementById('actionContainer');
const addAgendaBtn = document.getElementById('addAgenda');
const addDiscussionBtn = document.getElementById('addDiscussion');
const addActionBtn = document.getElementById('addAction');
const meetingForm = document.getElementById('meetingForm');
const minutesPreview = document.getElementById('minutesPreview');
const meetingsList = document.getElementById('meetingsList');
const formMessage = document.getElementById('formMessage');
const toggleAllAttendance = document.getElementById('toggleAllAttendance');
const copyPreviewBtn = document.getElementById('copyPreview');

let membersCache = [];
let meetingsCache = [];

const showMessage = (text, tone = 'info') => {
  formMessage.textContent = text;
  formMessage.className = tone === 'error' ? 'muted error' : 'muted';
};

const createAttendanceRow = (member) => {
  const row = document.createElement('div');
  row.className = 'attendance-row';
  row.dataset.memberId = member.id;
  row.innerHTML = `
    <header>
      <label>
        <input type="checkbox" class="attendance-toggle" checked />
        ${member.name}
      </label>
      <span>${member.role}</span>
    </header>
    <textarea placeholder="Participation notes"></textarea>
  `;
  return row;
};

const renderAttendance = (members) => {
  attendanceList.innerHTML = '';
  if (!members.length) {
    attendanceList.innerHTML = '<p class="muted">No members found.</p>';
    return;
  }
  members.forEach((member) => {
    attendanceList.appendChild(createAttendanceRow(member));
  });
};

const createAgendaRow = () => {
  const row = document.createElement('div');
  row.className = 'agenda-row';
  row.innerHTML = `
    <label>
      Title
      <input type="text" data-field="agenda-title" placeholder="Agenda item" />
    </label>
    <label>
      Talking points (one per line)
      <textarea rows="3" data-field="agenda-bullets" placeholder="Discuss research insights"></textarea>
    </label>
  `;
  return row;
};

const createDiscussionRow = () => {
  const row = document.createElement('div');
  row.className = 'discussion-row';
  row.innerHTML = `
    <div class="row-grid">
      <label>
        Item
        <input type="text" data-field="discussion-item" placeholder="Prototype feedback" />
      </label>
      <label>
        Who
        <input type="text" data-field="discussion-owner" placeholder="Owner" />
      </label>
    </div>
    <label>
      Notes
      <textarea rows="2" data-field="discussion-notes" placeholder="Summary of the discussion"></textarea>
    </label>
  `;
  return row;
};

const createActionRow = () => {
  const row = document.createElement('div');
  row.className = 'action-row';
  row.innerHTML = `
    <div class="row-grid">
      <label class="checkbox-inline">
        <input type="checkbox" data-field="action-done" /> Done
      </label>
      <label>
        Item
        <input type="text" data-field="action-item" placeholder="Deliver usability report" />
      </label>
      <label>
        Responsible
        <input type="text" data-field="action-responsible" placeholder="Assign owner" />
      </label>
      <label>
        Due date
        <input type="date" data-field="action-due" />
      </label>
    </div>
  `;
  return row;
};

const addDefaultRows = () => {
  agendaContainer.appendChild(createAgendaRow());
  discussionContainer.appendChild(createDiscussionRow());
  actionContainer.appendChild(createActionRow());
};

const serializeInputs = (container, selector) =>
  Array.from(container.querySelectorAll(selector));

const collectAgenda = () =>
  serializeInputs(agendaContainer, '.agenda-row').map((row, index) => {
    const title = row.querySelector('[data-field="agenda-title"]').value.trim();
    const bullets = row
      .querySelector('[data-field="agenda-bullets"]')
      .value.split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    return { title: title || `Agenda Item ${index + 1}`, bullets };
  }).filter((item) => item.title || item.bullets.length);

const collectDiscussion = () =>
  serializeInputs(discussionContainer, '.discussion-row').map((row) => ({
    item: row.querySelector('[data-field="discussion-item"]').value.trim(),
    owner: row.querySelector('[data-field="discussion-owner"]').value.trim(),
    notes: row.querySelector('[data-field="discussion-notes"]').value.trim()
  })).filter((entry) => entry.item || entry.notes);

const collectActions = () =>
  serializeInputs(actionContainer, '.action-row').map((row) => ({
    done: row.querySelector('[data-field="action-done"]').checked,
    item: row.querySelector('[data-field="action-item"]').value.trim(),
    responsible: row.querySelector('[data-field="action-responsible"]').value.trim(),
    dueDate: row.querySelector('[data-field="action-due"]').value
  })).filter((entry) => entry.item || entry.responsible);

const collectAttendance = () =>
  serializeInputs(attendanceList, '.attendance-row').map((row) => {
    const checkbox = row.querySelector('.attendance-toggle');
    const notes = row.querySelector('textarea').value.trim();
    return {
      memberId: parseInt(row.dataset.memberId, 10),
      status: checkbox.checked ? 'Present' : 'Absent',
      participation: notes
    };
  });

const populateMeetingsList = (meetings) => {
  meetingsList.innerHTML = '';
  if (!meetings.length) {
    meetingsList.innerHTML = '<p class="muted">No meetings recorded yet.</p>';
    return;
  }

  meetings.forEach((meeting) => {
    const entry = document.createElement('details');
    entry.className = 'meeting-entry';
    const info = meeting.meetingInfo || {};
    entry.innerHTML = `
      <summary>
        <strong>${info.purpose || 'Team Meeting'}</strong> · ${info.date || 'TBD'} (${meeting.attendance?.length || 0} attendees)
      </summary>
      <pre>${meeting.markdown || ''}</pre>
    `;
    meetingsList.appendChild(entry);
  });
};

const loadInitialData = async () => {
  try {
    const [membersRes, meetingsRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/meetings')
    ]);
    membersCache = await membersRes.json();
    meetingsCache = await meetingsRes.json();
    renderAttendance(membersCache);
    populateMeetingsList(meetingsCache);
  } catch (error) {
    console.error('Error loading meeting manager data:', error);
    showMessage('Unable to load roster or meetings. Please refresh.', 'error');
  }
};

const resetForm = () => {
  meetingForm.reset();
  agendaContainer.innerHTML = '';
  discussionContainer.innerHTML = '';
  actionContainer.innerHTML = '';
  addDefaultRows();
  renderAttendance(membersCache);
};

meetingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('Saving meeting minutes…');

  const payload = {
    meetingInfo: {
      date: document.getElementById('meetingDate').value,
      time: document.getElementById('meetingTime').value,
      purpose: document.getElementById('meetingPurpose').value.trim(),
      location: document.getElementById('meetingLocation').value.trim(),
      noteTaker: document.getElementById('noteTaker').value.trim()
    },
    attendance: collectAttendance(),
    agenda: collectAgenda(),
    discussion: collectDiscussion(),
    actionItems: collectActions(),
    communicationSummary: document.getElementById('communicationNotes').value.trim(),
    notes: document.getElementById('otherNotes').value.trim()
  };

  try {
    const response = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Failed to save meeting');
    }

    const savedMeeting = await response.json();
    minutesPreview.value = savedMeeting.markdown || '';
    meetingsCache = [savedMeeting, ...meetingsCache];
    populateMeetingsList(meetingsCache);
    showMessage('Meeting minutes saved. Markdown preview updated.');
    resetForm();
  } catch (error) {
    console.error('Error saving meeting:', error);
    showMessage('Could not save meeting. Please try again.', 'error');
  }
});

addAgendaBtn.addEventListener('click', () => agendaContainer.appendChild(createAgendaRow()));
addDiscussionBtn.addEventListener('click', () => discussionContainer.appendChild(createDiscussionRow()));
addActionBtn.addEventListener('click', () => actionContainer.appendChild(createActionRow()));

toggleAllAttendance.addEventListener('click', () => {
  const toggles = attendanceList.querySelectorAll('.attendance-toggle');
  const allSelected = Array.from(toggles).every((input) => input.checked);
  toggles.forEach((input) => {
    input.checked = !allSelected;
  });
});

copyPreviewBtn.addEventListener('click', async () => {
  if (!minutesPreview.value.trim()) return;
  try {
    await navigator.clipboard.writeText(minutesPreview.value);
    showMessage('Markdown copied to clipboard.');
  } catch (error) {
    console.error('Clipboard error:', error);
    showMessage('Unable to copy markdown.', 'error');
  }
});

addDefaultRows();
loadInitialData();
