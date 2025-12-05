// class_config.js

// Utility: show/hide element
function show(el) {
  el.style.display = 'block';
  el.setAttribute('aria-hidden', 'false');
}
function hide(el) {
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
}

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';

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

  function setStatus(el, message, color = '') {
    if (!el) return;
    el.textContent = message;
    el.style.color = color || '';
  }

  /* ----------------------------------------------------------
     Profile dropdown / navigation
  ---------------------------------------------------------- */
  const profileImg = document.getElementById('dashboardProfileImg');
  const dropdown = document.getElementById('profileDropdown');
  const logoutBtn = document.getElementById('logoutBtn');
  const backDashboard = document.getElementById('backDashboard');

  let dropdownTimeout = null;
  if (profileImg && dropdown) {
    profileImg.addEventListener('mouseenter', () => {
      clearTimeout(dropdownTimeout);
      show(dropdown);
    });
    profileImg.addEventListener('mouseleave', () => {
      dropdownTimeout = setTimeout(() => hide(dropdown), 150);
    });
    dropdown.addEventListener('mouseenter', () => {
      clearTimeout(dropdownTimeout);
      show(dropdown);
    });
    dropdown.addEventListener('mouseleave', () => {
      dropdownTimeout = setTimeout(() => hide(dropdown), 150);
    });

    profileImg.addEventListener('click', (e) => {
      e.preventDefault();
      if (dropdown.style.display === 'block') hide(dropdown);
      else show(dropdown);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = '/login';
    });
  }

  if (backDashboard) {
    backDashboard.addEventListener('click', (e) => {
      e.preventDefault();

      // Prefer canonical role from currentUser, fall back to legacy localStorage.role
      let role = '';
      try {
        const cuRaw = localStorage.getItem('currentUser');
        if (cuRaw) {
          const cu = JSON.parse(cuRaw);
          if (cu && cu.role) {
            role = String(cu.role).toLowerCase();
          }
        }
      } catch {
        // ignore
      }

      if (!role) {
        role = (localStorage.getItem('role') || '').toLowerCase();
      }

      if (role === 'professor') {
        window.location.href = '/dashboards/professor.html';
      } else if (role === 'teaching assistant' || role === 'ta') {
        window.location.href = '/dashboards/ta.html';
      } else if (role === 'team_lead' || role === 'team lead') {
        window.location.href = '/dashboards/team_lead.html';
      } else {
        window.location.href = '/dashboards/student.html';
      }
    });
  }

  const savedImg = localStorage.getItem('profileImg');
  if (savedImg && profileImg) profileImg.src = savedImg;

  /* ----------------------------------------------------------
     Roster upload (CSV -> backend)
     (unchanged logic; just decoupled from course description)
  ---------------------------------------------------------- */
  const classFileInput = document.getElementById('classRosterFile');
  const staffFileInput = document.getElementById('staffRosterFile');
  const uploadBtn = document.getElementById('uploadRostersBtn');
  const rosterStatus = document.getElementById('rosterStatus');

  function readCsvFile(file, onSuccess, onError) {
    if (!file) {
      onError('No file selected');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onError('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      if (!text.includes(',') || !text.includes('\n')) {
        onError('File does not look like CSV (missing commas/newlines).');
        return;
      }
      onSuccess(text);
    };
    reader.onerror = () => onError('Failed to read file');
    reader.readAsText(file);
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      setStatus(rosterStatus, '', '');

      const classFile = classFileInput?.files?.[0] || null;
      const staffFile = staffFileInput?.files?.[0] || null;

      if (!classFile && !staffFile) {
        setStatus(
          rosterStatus,
          'Select at least one roster to upload.',
          '#b45309',
        );
        return;
      }

      setStatus(rosterStatus, 'Reading files...', '');

      let classCsv = null;
      let staffCsv = null;
      const errors = [];

      const promises = [];

      if (classFile) {
        promises.push(
          new Promise((resolve) => {
            readCsvFile(
              classFile,
              (text) => {
                classCsv = text;
                resolve();
              },
              (err) => {
                errors.push(`student roster: ${err}`);
                resolve();
              },
            );
          }),
        );
      }

      if (staffFile) {
        promises.push(
          new Promise((resolve) => {
            readCsvFile(
              staffFile,
              (text) => {
                staffCsv = text;
                resolve();
              },
              (err) => {
                errors.push(`staff roster: ${err}`);
                resolve();
              },
            );
          }),
        );
      }

      await Promise.all(promises);

      if (errors.length) {
        setStatus(
          rosterStatus,
          `Upload finished with errors: ${errors.join(' • ')}`,
          '#b45309',
        );
        return;
      }

      // Send CSV content to backend
      try {
        setStatus(rosterStatus, 'Uploading to server...', '');
        const body = {
          classRosterCsv: classCsv,
          staffRosterCsv: staffCsv,
        };

        const result = await fetchJSON(`${API_BASE}/courses/rosters`, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        // Expecting something like:
        // { classRows: number, staffRows: number }
        const parts = [];
        if (typeof result.classRows === 'number') {
          parts.push(`students(${result.classRows} rows)`);
        }
        if (typeof result.staffRows === 'number') {
          parts.push(`staff(${result.staffRows} rows)`);
        }

        setStatus(
          rosterStatus,
          `Upload successful: ${parts.join(' • ') || 'no rows detected'}`,
          '',
        );
      } catch (err) {
        console.error('Failed to upload rosters:', err);
        setStatus(
          rosterStatus,
          'Failed to upload rosters to server. Please try again.',
          '#b91c1c',
        );
      }
    });
  }

  /* ----------------------------------------------------------
     Course description: load + save
     (no dependency on roster upload anymore)
  ---------------------------------------------------------- */
  const saveDescBtn = document.getElementById('saveDescriptionBtn');
  const descStatus = document.getElementById('courseDescriptionStatus');
  const courseDesc = document.getElementById('courseDescription');

  async function loadExistingCourseDescription() {
    if (!courseDesc) return;
    try {
      const course = await fetchJSON(`/api/class-directory/course`);
      const desc = (course && course.description) || '';
      if (typeof desc === 'string') {
        courseDesc.value = desc;
      }
    } catch (err) {
      // Not fatal, just log
      console.warn('No existing course description found:', err);
    }
  }

  if (saveDescBtn) {
    saveDescBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      setStatus(descStatus, '', '');

      const desc = (courseDesc?.value || '').trim();
      if (!desc) {
        setStatus(
          descStatus,
          'Please enter a course description before saving.',
          '#b45309',
        );
        return;
      }

      try {
        setStatus(descStatus, 'Saving course description...', '');
        const result = await fetchJSON(`/api/class-directory/course/description`, {
          method: 'PUT',
          body: JSON.stringify({ description: desc }),
        });

        // If API returns refreshed overview, use it to update field
        if (result && result.course && typeof result.course.description === 'string') {
          courseDesc.value = result.course.description;
        }
        setStatus(descStatus, 'Course description saved.', '');
      } catch (err) {
        console.error('Failed to save course description:', err);
        setStatus(
          descStatus,
          'Failed to save course description. Please try again.',
          '#b91c1c',
        );
      }
    });
  }

  // Initial load of existing course description (if any)
  loadExistingCourseDescription();
});
