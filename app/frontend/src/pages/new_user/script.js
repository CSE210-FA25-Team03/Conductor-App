/* global fetch */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const repeatPassword = document.getElementById('repeatPassword').value;
    
    // Validation
    if (password !== repeatPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    if (password.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }
    
    try {
      // Create member in the system (default to student role for new accounts)
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          role: 'student' // New accounts default to student
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          // Member already exists, proceed to login
          alert('Account already exists. Redirecting to login...');
        } else {
          throw new Error(error.error || 'Failed to create account');
        }
      } else {
        const member = await response.json();
        // Save to localStorage
        localStorage.setItem('firstName', firstName);
        localStorage.setItem('lastName', lastName);
        localStorage.setItem('email', email);
        localStorage.setItem('role', 'student');
        localStorage.setItem('memberId', member.id);
        
        alert('Account created successfully! Redirecting to dashboard...');
      }
      
      // Redirect to login or dashboard
      setTimeout(() => {
        window.location.href = '/dashboards/student.html';
      }, 1000);
      
    } catch (error) {
      console.error('Error creating account:', error);
      alert('Failed to create account. Please try again.');
    }
  });
});

