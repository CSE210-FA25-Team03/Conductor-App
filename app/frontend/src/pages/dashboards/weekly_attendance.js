// weekly_attendance.js
// Weekly attendance submission form - CORRECTED: stores actual dates

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
   * Periods are consecutive 7-day blocks: 1-7, 8-14, 15-21, 22-28, etc.
   */
  function calculatePeriod(date) {
    const d = new Date(date);
    const dayOfMonth = d.getDate();
    
    // Calculate period start day: 1, 8, 15, 22, 29, etc.
    const periodStartDay = Math.floor((dayOfMonth - 1) / 7) * 7 + 1;
    
    const periodStart = new Date(d.getFullYear(), d.getMonth(), periodStartDay);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);
    
    // Format dates in local timezone
    function formatLocalDate(dateObj) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return {
      startDate: formatLocalDate(periodStart),
      endDate: formatLocalDate(periodEnd),
    };
  }

  /**
   * Generate period label from dates
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
   * Format date for display (e.g., "Nov 2, 2025")
   */
  function formatDateDisplay(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  // Find attendance panel elements
  const attendancePanel = document.getElementById('attendancePanel');
  const openAttendanceBtn = document.getElementById('openAttendanceDrawer');
  const closeAttendanceBtn = document.querySelector('.close-attendance');
  const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
  const pastAttendanceList = document.getElementById('pastAttendanceList');

  // Date picker containers for each attendance type
  const datePickerContainers = {
    class: document.getElementById('attClassDates'),
    group_meeting: document.getElementById('attGroupDates'),
    office_hours: document.getElementById('attOfficeDates'),
    class_meeting: document.getElementById('attClassMeetingDates'),
  };

  // Date picker inputs
  const datePickers = {
    class: document.getElementById('attClassDatePicker'),
    group_meeting: document.getElementById('attGroupDatePicker'),
    office_hours: document.getElementById('attOfficeDatePicker'),
    class_meeting: document.getElementById('attClassMeetingDatePicker'),
  };

  if (!attendancePanel || !saveAttendanceBtn) {
    // Attendance form not present on this page
    return;
  }

  // Store selected dates for each type
  const selectedDates = {
    class: new Set(),
    group_meeting: new Set(),
    office_hours: new Set(),
    class_meeting: new Set(),
  };

  // ---------------------------------------------------------------------------
  // Date Management
  // ---------------------------------------------------------------------------
  
  /**
   * Normalize date string to YYYY-MM-DD format
   * Handles ISO strings, Date objects, and already-normalized strings
   */
  function normalizeDate(dateInput) {
    if (!dateInput) return null;
    
    // If already in YYYY-MM-DD format, return as-is
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    
    // Try to parse as Date and format
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return null;
      }
      
      // Format as YYYY-MM-DD in local timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return null;
    }
  }

  /**
   * Check if a date is within the last 3 days (including today)
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {boolean} - True if date is within last 3 days
   */
  function isWithinLast3Days(dateStr) {
    if (!dateStr) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2); // 3 days: today, yesterday, day before
    
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate >= threeDaysAgo && checkDate <= today;
  }
  
  /**
   * Add a date to the selected dates for a type
   */
  function addDate(type, dateInput) {
    if (!dateInput) return;
    
    // Normalize the date to YYYY-MM-DD format
    const normalizedDate = normalizeDate(dateInput);
    
    if (!normalizedDate) {
      alert('Invalid date format. Please use YYYY-MM-DD');
      return;
    }
    
    // Check if date is within last 3 days
    if (!isWithinLast3Days(normalizedDate)) {
      alert('You can only add attendance for dates within the last 3 days.');
      return;
    }
    
    selectedDates[type].add(normalizedDate);
    renderDateList(type);
    
    // Clear the date picker
    if (datePickers[type]) {
      datePickers[type].value = '';
    }
  }

  /**
   * Remove a date from selected dates
   */
  function removeDate(type, dateStr) {
    selectedDates[type].delete(dateStr);
    renderDateList(type);
  }

  /**
   * Render the list of selected dates for a type (only shows dates within last 3 days)
   */
  function renderDateList(type) {
    const container = datePickerContainers[type];
    if (!container) return;
    
    // Filter to only show dates within last 3 days
    const allDates = Array.from(selectedDates[type]);
    const recentDates = allDates.filter(dateStr => isWithinLast3Days(dateStr)).sort();
    
    let dateList = container.querySelector('.selected-dates-list');
    if (!dateList) {
      dateList = document.createElement('div');
      dateList.className = 'selected-dates-list';
      container.appendChild(dateList);
    }
    
    if (recentDates.length === 0) {
      dateList.innerHTML = '<span class="selected-dates-empty">No dates selected (only last 3 days shown)</span>';
      return;
    }
    
    dateList.innerHTML = recentDates.map(dateStr => {
      const period = calculatePeriod(dateStr);
      const periodLabel = period ? generatePeriodLabel(period.startDate, period.endDate) : '';
      const displayDate = formatDateDisplay(dateStr);
      return `
        <div class="date-chip">
          <button 
            type="button" 
            class="date-chip-remove" 
            data-type="${type}" 
            data-date="${dateStr}"
            aria-label="Remove ${displayDate}"
            title="Remove ${displayDate}"
          >×</button>
          <div class="date-chip-date">${displayDate}</div>
          <div class="date-chip-period">${periodLabel}</div>
        </div>
      `;
    }).join('');
    
    dateList.querySelectorAll('.date-chip-remove').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const selectedType = btn.getAttribute('data-type');
        const dateValue = btn.getAttribute('data-date');
        removeDate(selectedType, dateValue);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Load existing attendance records
  // ---------------------------------------------------------------------------
  let existingRecords = [];

  async function loadExistingRecords() {
    try {
      const result = await fetchJSON(
        `${API_BASE}/attendance/weekly/user?email=${encodeURIComponent(email)}`,
      );

      existingRecords = result.records || [];
      
      // Group records by type and populate selectedDates
      selectedDates.class.clear();
      selectedDates.group_meeting.clear();
      selectedDates.office_hours.clear();
      selectedDates.class_meeting.clear();
      
      existingRecords.forEach(record => {
        const type = record.attendanceType;
        if (selectedDates[type] && record.attendanceDate) {
          // Normalize date from API (might be ISO string) to YYYY-MM-DD
          const normalizedDate = normalizeDate(record.attendanceDate);
          if (normalizedDate && isWithinLast3Days(normalizedDate)) {
            // Only load dates within last 3 days
            selectedDates[type].add(normalizedDate);
          }
        }
      });
      
      // Render all date lists (only shows dates within last 3 days)
      Object.keys(selectedDates).forEach(type => {
        renderDateList(type);
      });
    } catch (err) {
      console.error('Failed to load existing records:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Load past submissions (for display)
  // ---------------------------------------------------------------------------
  async function loadPastSubmissions() {
    if (!pastAttendanceList) return;

    try {
      const result = await fetchJSON(
        `${API_BASE}/attendance/weekly/user?email=${encodeURIComponent(email)}`,
      );

      const records = result.records || [];
      
      // Group records by period
      const recordsByPeriod = {};
      records.forEach(record => {
        const periodKey = record.period.startDate;
        if (!recordsByPeriod[periodKey]) {
          recordsByPeriod[periodKey] = {
            period: record.period,
            types: {},
          };
        }
        if (!recordsByPeriod[periodKey].types[record.attendanceType]) {
          recordsByPeriod[periodKey].types[record.attendanceType] = [];
        }
        recordsByPeriod[periodKey].types[record.attendanceType].push(record.attendanceDate);
      });
      
      const periods = Object.values(recordsByPeriod).sort((a, b) => 
        new Date(b.period.startDate) - new Date(a.period.startDate)
      );

      if (periods.length === 0) {
        pastAttendanceList.innerHTML = '<li style="color: #777; padding: 0.5rem;">No past submissions</li>';
        return;
      }

      pastAttendanceList.innerHTML = periods.map(({ period, types }) => {
        const typeLabels = {
          class: 'Class',
          group_meeting: 'Group Meeting',
          office_hours: 'Office Hours',
          class_meeting: 'Class Meeting',
        };
        
        const typeList = Object.entries(types).map(([type, dates]) => {
          const dateStrs = dates.map(d => formatDateDisplay(d)).join(', ');
          return `${typeLabels[type] || type}: ${dateStrs}`;
        }).join('; ');
        
        return `
          <li style="padding: 0.5rem; border-bottom: 1px solid #eee;">
            <strong>${period.label || period.startDate}</strong>
            <div style="font-size: 0.9rem; color: #666; margin-top: 0.25rem;">
              ${typeList || 'No attendance marked'}
            </div>
          </li>
        `;
      }).join('');
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

    // Build attendanceDates object, ensuring all dates are normalized and within last 3 days
    const attendanceDates = {
      class: Array.from(selectedDates.class)
        .map(d => normalizeDate(d))
        .filter(d => d && isWithinLast3Days(d)),
      group_meeting: Array.from(selectedDates.group_meeting)
        .map(d => normalizeDate(d))
        .filter(d => d && isWithinLast3Days(d)),
      office_hours: Array.from(selectedDates.office_hours)
        .map(d => normalizeDate(d))
        .filter(d => d && isWithinLast3Days(d)),
      class_meeting: Array.from(selectedDates.class_meeting)
        .map(d => normalizeDate(d))
        .filter(d => d && isWithinLast3Days(d)),
    };

    // Check if any dates are selected
    const hasAnyDates = Object.values(attendanceDates).some(dates => dates.length > 0);
    if (!hasAnyDates) {
      alert('Please select at least one attendance date.');
      return;
    }

    saveAttendanceBtn.disabled = true;
    saveAttendanceBtn.textContent = 'Saving...';

    try {
      const method = existingRecords.length > 0 ? 'PUT' : 'POST';
      const result = await fetchJSON(`${API_BASE}/attendance/weekly/submit`, {
        method,
        body: JSON.stringify({
          email,
          attendanceDates,
        }),
      });

      if (result.success) {
        // Reload records
        await loadExistingRecords();
        await loadPastSubmissions();

        // Show success message
        const message = existingRecords.length > 0
          ? 'Attendance updated successfully!'
          : 'Attendance saved successfully!';
        if (result.isUpdate) {
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
  // Initialize date picker handlers
  // ---------------------------------------------------------------------------
  function initializeDatePickers() {
    // Calculate date range (last 3 days: today, yesterday, day before)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2); // 3 days: today, yesterday, day before
    
    // Format dates for input min/max attributes
    function formatDateForInput(dateObj) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const minDate = formatDateForInput(threeDaysAgo);
    const maxDate = formatDateForInput(today);
    
    Object.keys(datePickers).forEach(type => {
      const picker = datePickers[type];
      if (!picker) return;
      
      // Set min and max dates to restrict selection to last 3 days
      picker.setAttribute('min', minDate);
      picker.setAttribute('max', maxDate);
      
      // Add button click handler
      const addBtn = picker.parentElement?.querySelector('.add-date-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const dateStr = picker.value;
          if (dateStr) {
            addDate(type, dateStr);
          }
        });
      }
      
      // Enter key handler
      picker.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const dateStr = picker.value;
          if (dateStr) {
            addDate(type, dateStr);
          }
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Panel open/close
  // ---------------------------------------------------------------------------
  function openPanel() {
    if (attendancePanel) {
      attendancePanel.setAttribute('aria-hidden', 'false');
      attendancePanel.style.display = 'block';
      loadExistingRecords();
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

  // Initialize date pickers
  initializeDatePickers();
});

