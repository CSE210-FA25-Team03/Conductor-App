

// Simple login form logic without validation

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('passwordToggle');
    const successMessage = document.getElementById('successMessage');
    const roleSelect = document.getElementById('role');

    // Password show/hide toggle
    passwordToggle.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        const icon = passwordToggle.querySelector('.toggle-icon');
        icon.classList.toggle('show-password', type === 'text');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        // No validation, just show success
        form.style.display = 'none';
        successMessage.classList.add('show');
        setTimeout(() => {
            // Redirect based on role
            const role = roleSelect.value;
            if (role === 'professor') {
                window.location.href = '../professor/index.html';
            } else if (role === 'student') {
                window.location.href = '../student/index.html';
            } else if (role === 'ta') {
                window.location.href = '../ta/index.html';
            } else if (role === 'tutor') {
                window.location.href = '../tutor/index.html';
            } else {
                window.location.href = '/';
            }
        }, 1200);
    });
});
