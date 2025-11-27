// class_config.js

// Utility: show/hide element
function show(el) { el.style.display = 'block'; el.setAttribute('aria-hidden', 'false'); }
function hide(el) { el.style.display = 'none'; el.setAttribute('aria-hidden', 'true'); }

document.addEventListener('DOMContentLoaded', () => {
  const profileImg = document.getElementById('dashboardProfileImg');
  const dropdown = document.getElementById('profileDropdown');
  const logoutBtn = document.getElementById('logoutBtn');
  const backDashboard = document.getElementById('backDashboard');

  // Profile dropdown: show on hover, toggle on click for accessibility
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
      if (dropdown.style.display === 'block') hide(dropdown); else show(dropdown);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      // go to login (adjust path as needed)
      window.location.href = '/login';
    });
  }

  // Back to dashboard routing by role
  if (backDashboard) {
    backDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      const role = (localStorage.getItem('role') || '').toLowerCase();
      if (role === 'professor' || role === 'prof') {
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

  // Prefill profile image from localStorage if present
  const savedImg = localStorage.getItem('profileImg');
  if (savedImg && profileImg) profileImg.src = savedImg;

  // Roster handling
  const classFileInput = document.getElementById('classRosterFile');
  const staffFileInput = document.getElementById('staffRosterFile');
  const uploadBtn = document.getElementById('uploadRostersBtn');
  const rosterStatus = document.getElementById('rosterStatus');

  let parsedClassRoster = null;
  let parsedStaffRoster = null;

  function readCsvFile(file, onSuccess, onError) {
    if (!file) { onError('No file selected'); return; }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onError('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      // Basic sanity check: ensure at least one comma and one newline
      if (!text.includes(',') || !text.includes('\n')) {
        onError('File does not look like CSV (missing commas/newlines).');
        return;
      }
      onSuccess(text);
    };
    reader.onerror = () => onError('Failed to read file');
    reader.readAsText(file);
  }

  uploadBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    rosterStatus.textContent = '';
    const classFile = classFileInput.files[0];
    const staffFile = staffFileInput.files[0];

    if (!classFile && !staffFile) {
      rosterStatus.textContent = 'Select at least one roster to upload.';
      return;
    }

    rosterStatus.textContent = 'Processing...';

    const promises = [];

    if (classFile) {
      promises.push(new Promise((resolve) => {
        readCsvFile(classFile, (text) => {
          parsedClassRoster = text;
          resolve({ type: 'class', ok: true, rows: text.split(/\r?\n/).filter(Boolean).length - 1 });
        }, (err) => {
          resolve({ type: 'class', ok: false, error: err });
        });
      }));
    }

    if (staffFile) {
      promises.push(new Promise((resolve) => {
        readCsvFile(staffFile, (text) => {
          parsedStaffRoster = text;
          resolve({ type: 'staff', ok: true, rows: text.split(/\r?\n/).filter(Boolean).length - 1 });
        }, (err) => {
          resolve({ type: 'staff', ok: false, error: err });
        });
      }));
    }

    const results = await Promise.all(promises);
    const errors = results.filter(r => !r.ok);
    if (errors.length) {
      rosterStatus.textContent = `Upload finished with errors: ${errors.map(e => `${e.type}: ${e.error}`).join('; ')}`;
      rosterStatus.style.color = '#b45309'; // amber
      return;
    }

    rosterStatus.style.color = ''; // reset
    rosterStatus.textContent = `Upload successful: ${results.map(r => `${r.type}(${r.rows} rows)`).join(' • ')}`;
  });

  // Create course button
  const createBtn = document.getElementById('createCourseBtn');
  const createStatus = document.getElementById('createCourseStatus');
  const courseDesc = document.getElementById('courseDescription');

  createBtn.addEventListener('click', (e) => {
    e.preventDefault();
    createStatus.textContent = '';

    // Basic validation: course description non-empty and at least one roster uploaded
    const desc = (courseDesc.value || '').trim();
    if (!desc) {
      createStatus.textContent = 'Please enter a course description.';
      createStatus.style.color = '#b45309';
      return;
    }
    if (!parsedClassRoster && !parsedStaffRoster) {
      createStatus.textContent = 'Please upload at least one roster before creating the course.';
      createStatus.style.color = '#b45309';
      return;
    }

    // Simulate successful creation (replace with fetch/ajax to server in real app)
    createStatus.style.color = '';
    createStatus.textContent = 'Course created successfully.';
    // Example: store course description in localStorage (for demo purposes)
    localStorage.setItem('lastCourseDescription', desc);
  });

});
