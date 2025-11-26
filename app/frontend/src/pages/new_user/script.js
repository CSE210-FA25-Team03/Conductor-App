
/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} - True if strings are equal
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate password requirements
 * @param {string} password - Password to validate
 * @returns {string|null} - Error message or null if valid
 */
function validatePassword(password) {
  if (password.length < 6) {
    return 'Password must be at least 6 characters long!';
  }
  return null;
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
  alert(message);
}

/**
 * Show success message to user
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
  alert(message);
}

/**
 * Save user data to localStorage
 * @param {string} firstName - User's first name
 * @param {string} lastName - User's last name
 * @param {string} email - User's email
 * @param {number} memberId - User's member ID
 */
function saveUserToLocalStorage(firstName, lastName, email, memberId) {
  localStorage.setItem('firstName', firstName);
  localStorage.setItem('lastName', lastName);
  localStorage.setItem('email', email);
  localStorage.setItem('role', 'student');
  localStorage.setItem('memberId', String(memberId));
}

/**
 * Redirect to student dashboard
 */
function redirectToDashboard() {
  const dashboardUrl = '/dashboards/student.html';
  window.location.href = dashboardUrl;
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  const loginUrl = '/login';
  window.location.href = loginUrl;
}

/**
 * Create new user account
 * @param {string} firstName - User's first name
 * @param {string} lastName - User's last name
 * @param {string} email - User's email
 * @returns {Promise<Object>} - Created member object
 */
async function createMember(firstName, lastName, email) {
  const response = await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName,
      lastName,
      email,
      role: 'student'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 409) {
      throw new Error('ACCOUNT_EXISTS');
    }
    throw new Error(error.error || 'Failed to create account');
  }

  return await response.json();
}

/**
 * Handle form submission
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  
  if (!form) {
    console.error('Form not found');
    return;
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const repeatPasswordInput = document.getElementById('repeatPassword');
    
    if (!firstNameInput || !lastNameInput || !emailInput || !passwordInput || !repeatPasswordInput) {
      showError('Form fields not found. Please refresh the page.');
      return;
    }
    
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const repeatPassword = repeatPasswordInput.value;
    
    // Validate passwords match (using constant-time comparison)
    if (!constantTimeCompare(password, repeatPassword)) {
      showError('Passwords do not match!');
      return;
    }
    
    // Validate password requirements
    const passwordError = validatePassword(password);
    if (passwordError) {
      showError(passwordError);
      return;
    }
    
    try {
      const member = await createMember(firstName, lastName, email);
      saveUserToLocalStorage(firstName, lastName, email, member.id);
      showSuccess('Account created successfully! Redirecting to dashboard...');
      
      // Redirect after delay
      setTimeout(redirectToDashboard, 1000);
      
    } catch (error) {
      console.error('Error creating account:', error);
      
      if (error.message === 'ACCOUNT_EXISTS') {
        showError('Account already exists. Redirecting to login...');
        setTimeout(redirectToLogin, 1000);
      } else {
        showError('Failed to create account. Please try again.');
      }
    }
  });
});

