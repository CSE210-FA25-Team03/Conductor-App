// frontend/src/pages/login_page/script.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const successMessage = document.getElementById('successMessage');
  const errorBox = document.getElementById('loginError');
  const googleLoginButton = document.getElementById('googleLoginButton');
  const emailInput = document.getElementById('email');
  const classCodeInput = document.getElementById('classCode');
  const classCodeRow = classCodeInput ? classCodeInput.closest('.input_box') : null;

  if (googleLoginButton) {
    googleLoginButton.addEventListener('click', (event) => {
      event.preventDefault();

      const email = (emailInput?.value || '').trim().toLowerCase();
      const isAdmin = email === 'admin@school.edu';
      const classCode = (classCodeInput?.value || '').trim();

      if (!isAdmin && !classCode) {
        alert('Please enter a class number before using Google login.');
        return;
      }

      const url = isAdmin
        ? `/auth/google/start`
        : `/auth/google/start?classCode=${encodeURIComponent(classCode)}`;

      window.location.href = url;
    });
  }
  // Hide class code field when admin email is entered
  function toggleClassCodeVisibility() {
    const email = (emailInput?.value || '').trim().toLowerCase();
    const isAdmin = email === 'admin@school.edu';
    if (classCodeInput) {
      // Remove required for admin to prevent HTML5 validation prompt
      if (isAdmin) {
        classCodeInput.removeAttribute('required');
        classCodeInput.disabled = true;
        classCodeInput.style.backgroundColor = '#f3f4f6'; // light grey
        classCodeInput.style.color = '#6b7280';
        classCodeInput.placeholder = 'Class number not required for admin';
      } else {
        classCodeInput.setAttribute('required', '');
        classCodeInput.disabled = false;
        classCodeInput.style.backgroundColor = '';
        classCodeInput.style.color = '';
        classCodeInput.placeholder = 'CSE 210';
      }
    }
  }
  emailInput?.addEventListener('input', toggleClassCodeVisibility);
  emailInput?.addEventListener('blur', toggleClassCodeVisibility);
  // Initialize state on load
  toggleClassCodeVisibility();

  function showError(message) {
    if (!errorBox) {
      alert(message);
      return;
    }
    errorBox.textContent = message;
    errorBox.style.display = 'block';
  }

  function clearError() {
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
  }

  const params = new URLSearchParams(window.location.search);
  const err = params.get('error');

  if (err) {
    if (err === 'not_enrolled') {
      showError('You are not enrolled in this course.');
    } else if (err === 'no_role') {
      showError('Your account does not have a valid course role.');
    } else if (err === 'unknown_role') {
      showError('Your role is not recognized. Please contact the instructor.');
    }
    setTimeout(() => {
      clearError();
    }, 4000);
    // Clean up the URL so refresh doesn’t re-show the error
    window.history.replaceState({}, '', window.location.pathname);
  }
  // Password show/hide
  passwordToggle?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    passwordToggle.classList.toggle('show-password', isPassword);
    passwordToggle.setAttribute(
      'aria-label',
      isPassword ? 'Hide password' : 'Show password',
    );
  });

  async function resolveLogin(email) {
    const classCode = (classCodeInput?.value || '').trim();
    const isAdmin = (email || '').trim().toLowerCase() === 'admin@school.edu';

    const res = await fetch('/api/auth/resolve-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, classCode: isAdmin ? '' : classCode }),
    });

    const text = await res.text().catch(() => '');
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse errors
    }

    if (!res.ok || !data || data.success === false) {
      const msg =
        (data && data.message) ||
        `Login failed (HTTP ${res.status}). Please check your email or contact your instructor.`;
      throw new Error(msg);
    }

    return data;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const firstName = document.getElementById('firstname')?.value?.trim() || '';
    const lastName = document.getElementById('lastname')?.value?.trim() || '';
    const emailRaw = document.getElementById('email').value.trim();
    const email = emailRaw.toLowerCase();

    if (!email) {
      showError('Please enter your email.');
      return;
    }

    // For now we do not validate password; auth is roster/role-based.
    try {
      // Ask backend: who is this user in this course?
      const result = await resolveLogin(email);
      const {
        user,
        primaryRole,
        redirectPath,
        roles,
        isTeamLead,
        teamLeadTeams,
        courseId,
      } = result;

      // Legacy fields (still used by some dashboards)
      // NOTE: role label here is only for UI text, routing comes from primaryRole.
      let legacyRoleLabel = 'student';
      if (primaryRole === 'professor') {
        legacyRoleLabel = 'professor';
      } else if (primaryRole === 'ta') {
        legacyRoleLabel = 'Teaching Assistant';
      } else if (primaryRole === 'team_lead') {
        legacyRoleLabel = 'team_lead';
      } else if (primaryRole === 'tutor') {
        legacyRoleLabel = 'tutor';
      }

      localStorage.setItem('firstName', firstName);
      localStorage.setItem('lastName', lastName);
      localStorage.setItem('email', email);
      localStorage.setItem('role', legacyRoleLabel);

      // Unified identity object used by dashboards, attendance, journals, etc.
      const currentUser = {
        id: user?.id || null,
        email: user?.email || email,
        role: primaryRole,           // canonical role
        legacyRoleLabel,             // for old UI text checks
        classId: courseId || null,
        givenName: firstName,
        familyName: lastName,
        displayName:
          user?.displayName ||
          `${firstName} ${lastName}`.trim() ||
          (user?.email || email),
        roles: roles || [],
        isTeamLead: !!isTeamLead,
        teamLeadTeams: teamLeadTeams || [],
      };

      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      // UI feedback: show success message clearly
      form.setAttribute('aria-hidden', 'true');
      form.style.display = 'none';
      if (successMessage) {
        successMessage.style.display = 'block';
        successMessage.classList.add('show');
      }

      setTimeout(() => {
        window.location.href = redirectPath || '../dashboards/student.html';
      }, 1200);
    } catch (err) {
      console.error('Login error:', err);
      showError(err.message || 'Login failed. Please try again.');
    }
  });


});
