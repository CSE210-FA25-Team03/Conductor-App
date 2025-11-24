document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const successMessage = document.getElementById('successMessage');
  const roleSelect = document.getElementById('role');

  // const roleRoutes = {
  //   professor: '../dashboards/professor.html',
  //   'Teaching Assistant': '../dashboards/ta.html',
  //   team_lead: '../dashboards/team_lead.html',
  //   student: '../dashboards/student.html',
  // };

  passwordToggle?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    passwordToggle.classList.toggle('show-password', isPassword);
    passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    form.setAttribute('aria-hidden', 'true');
    form.style.display = 'none';
    successMessage.classList.add('show');

    // Save user info to localStorage
    localStorage.setItem('firstName', document.getElementById('firstname').value);
    localStorage.setItem('lastName', document.getElementById('lastname').value);
    localStorage.setItem('email', document.getElementById('email').value);
    localStorage.setItem('role', roleSelect.value);

    let target = '../dashboards/student.html';
    if (roleSelect.value === 'professor') {
      target = '../dashboards/professor.html';
    } else if (roleSelect.value === 'Teaching Assistant') {
      target = '../dashboards/ta.html';
    } else if (roleSelect.value === 'team_lead') {
      target = '../dashboards/team_lead.html';
    }

    setTimeout(() => {
  window.location.href = target;
    }, 800);
  });
});
