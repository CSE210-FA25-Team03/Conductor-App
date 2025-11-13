document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const successMessage = document.getElementById('successMessage');
  const roleSelect = document.getElementById('role');

  const roleRoutes = {
    professor: '../dashboards/professor.html',
    ta: '../dashboards/ta.html',
    student: '../dashboards/student.html',
  };

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

    const target = roleRoutes[roleSelect.value] || '../dashboards/student.html';

    setTimeout(() => {
      window.location.href = target;
    }, 800);
  });
});
