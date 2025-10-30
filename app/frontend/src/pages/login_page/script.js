

// Simple login form logic without validation
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('passwordToggle');
    const successMessage = document.getElementById('successMessage');

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
            // Simulate redirect
            window.location.href = '/';
        }, 2000);
    });
});
