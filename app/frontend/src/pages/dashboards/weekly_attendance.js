// weekly_attendance.js
// Weekly attendance submission form for Students and Team Leads

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';

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

  /**
   * Calculate 7-day period from a date
   * Returns dates in YYYY-MM-DD format in local timezone
   */
  function calculatePeriod(date = new Date()) {
    const d = new Date(date);
    const startDate = new Date(d);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    // Format dates in local timezone (not UTC) to avoid timezone conversion issues
    function formatLocalDate(dateObj) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return {
      startDate: formatLocalDate(startDate),
      endDate: formatLocalDate(endDate),
    };
  }

  /**
   * Generate period label
   */
  function generatePeriodLabel(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const endMonth = end.toLocaleString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()}-${end.getDate()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  }

  /**
   * Check if update is within 2-day window
   */
  function canUpdate(periodEndDate) {
    const endDate = new Date(periodEndDate);
    const deadline = new Date(endDate);
    deadline.setDate(deadline.getDate() + 2);
    deadline.setHours(23, 59, 59, 999);

    return new Date() <= deadline;
  }

  // ---------------------------------------------------------------------------
  // DOM References
  // ---------------------------------------------------------------------------
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    console.warn('Weekly attendance: missing currentUser/email.');
    return;
  }

  const email = currentUser.email.toLowerCase();

  // Find attendance panel elements (may be in different dashboards)
  const attendancePanel = document.getElementById('attendancePanel');
  const openAttendanceBtn = document.getElementById('openAttendanceDrawer');
  const closeAttendanceBtn = document.querySelector('.close-attendance');
  const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
  const pastAttendanceList = document.getElementById('pastAttendanceList');

  // Checkboxes
  const attClass = document.getElementById('attClass');
  const attGroup = document.getElementById('attGroup');
  const attOffice = document.getElementById('attOffice');
  const attClassMeeting = document.getElementById('attClassMeeting');

  if (!attendancePanel || !saveAttendanceBtn) {
    // Attendance form not present on this page
    return;
  }

  // ---------------------------------------------------------------------------
  // Load current period submission
  // ---------------------------------------------------------------------------
  let currentSubmission = null;

  async function loadCurrentPeriod() {
    try {
      const period = calculatePeriod();
      const result = await fetchJSON(
        `${API_BASE}/attendance/weekly/user?email=${encodeURIComponent(email)}&periodStartDate=${period.startDate}`,
      );

      if (result.submissions && result.submissions.length > 0) {
        currentSubmission = result.submissions[0];
        // Pre-fill checkboxes
        if (currentSubmission.attendanceTypes) {
          attClass.checked = currentSubmission.attendanceTypes.class === true;
          attGroup.checked = currentSubmission.attendanceTypes.group_meeting === true;
          attOffice.checked = currentSubmission.attendanceTypes.office_hours === true;
          attClassMeeting.checked = currentSubmission.attendanceTypes.class_meeting === true;
        }
      } else {
        // Clear checkboxes for new submission
        attClass.checked = false;
        attGroup.checked = false;
        attOffice.checked = false;
        attClassMeeting.checked = false;
        currentSubmission = null;
      }
    } catch (err) {
      console.error('Failed to load current period:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Load past submissions
  // ---------------------------------------------------------------------------
  async function loadPastSubmissions() {
    if (!pastAttendanceList) return;

    try {
      const result = await fetchJSON(
        `${API_BASE}/attendance/weekly/user?email=${encodeURIComponent(email)}`,
      );

      const submissions = result.submissions || [];
      const pastSubmissions = submissions.filter(
        (s) => s.periodStartDate !== currentSubmission?.periodStartDate,
      );

      if (pastSubmissions.length === 0) {
        pastAttendanceList.innerHTML = '<li style="color: #777; padding: 0.5rem;">No past submissions</li>';
        return;
      }

      pastAttendanceList.innerHTML = pastSubmissions
        .map((submission) => {
          const types = submission.attendanceTypes || {};
          const typesList = [];
          if (types.class) typesList.push('Class');
          if (types.group_meeting) typesList.push('Group Meeting');
          if (types.office_hours) typesList.push('Office Hours');
          if (types.class_meeting) typesList.push('Class Meeting');

          const updated = new Date(submission.updatedAt).toLocaleDateString();
          const canUpdate = submission.canUpdate ? '' : ' (Update window expired)';

          return `
            <li style="padding: 0.5rem; border-bottom: 1px solid #eee;">
              <strong>${submission.periodLabel || submission.periodStartDate}</strong>
              <div style="font-size: 0.9rem; color: #666; margin-top: 0.25rem;">
                ${typesList.length > 0 ? typesList.join(', ') : 'No attendance marked'}
                <span style="margin-left: 0.5rem; color: #999;">Updated: ${updated}</span>
                ${canUpdate}
              </div>
            </li>
          `;
        })
        .join('');
    } catch (err) {
      console.error('Failed to load past submissions:', err);
      pastAttendanceList.innerHTML = '<li style="color: #b00020;">Failed to load past submissions</li>';
    }
  }

  // ---------------------------------------------------------------------------
  // Save attendance
  // ---------------------------------------------------------------------------
  async function saveAttendance() {
    if (!saveAttendanceBtn) return;

    const period = calculatePeriod();
    const attendanceTypes = {
      class: attClass.checked,
      group_meeting: attGroup.checked,
      office_hours: attOffice.checked,
      class_meeting: attClassMeeting.checked,
    };

    const periodLabel = generatePeriodLabel(period.startDate, period.endDate);

    // Check if this is an update and if update window is still open
    if (currentSubmission && !currentSubmission.canUpdate) {
      alert('Update window has expired. You can only update attendance within 2 days after the period ends.');
      return;
    }

    saveAttendanceBtn.disabled = true;
    saveAttendanceBtn.textContent = 'Saving...';

    try {
      const method = currentSubmission ? 'PUT' : 'POST';
      const result = await fetchJSON(`${API_BASE}/attendance/weekly/submit`, {
        method,
        body: JSON.stringify({
          email,
          periodStartDate: period.startDate,
          periodEndDate: period.endDate,
          periodLabel,
          attendanceTypes,
        }),
      });

      if (result.success) {
        // Reload current period and past submissions
        await loadCurrentPeriod();
        await loadPastSubmissions();

        // Show success message
        const message = currentSubmission
          ? 'Attendance updated successfully!'
          : 'Attendance saved successfully!';
        if (result.notificationSent) {
          alert(`${message} Your team lead has been notified.`);
        } else {
          alert(message);
        }
      } else {
        alert(result.error || 'Failed to save attendance');
      }
    } catch (err) {
      console.error('Failed to save attendance:', err);
      alert('Failed to save attendance. Please try again.');
    } finally {
      saveAttendanceBtn.disabled = false;
      saveAttendanceBtn.textContent = 'Save Attendance';
    }
  }

  // ---------------------------------------------------------------------------
  // Panel open/close
  // ---------------------------------------------------------------------------
  function openPanel() {
    if (attendancePanel) {
      attendancePanel.setAttribute('aria-hidden', 'false');
      attendancePanel.style.display = 'block';
      loadCurrentPeriod();
      loadPastSubmissions();
    }
  }

  function closePanel() {
    if (attendancePanel) {
      attendancePanel.setAttribute('aria-hidden', 'true');
      attendancePanel.style.display = 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------
  if (openAttendanceBtn) {
    openAttendanceBtn.addEventListener('click', openPanel);
  }

  if (closeAttendanceBtn) {
    closeAttendanceBtn.addEventListener('click', closePanel);
  }

  if (saveAttendanceBtn) {
    saveAttendanceBtn.addEventListener('click', saveAttendance);
  }

  // Close on backdrop click
  if (attendancePanel) {
    attendancePanel.addEventListener('click', (e) => {
      if (e.target === attendancePanel) {
        closePanel();
      }
    });
  }
});

