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

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const firstName = document.getElementById('firstname').value.trim();
    const lastName = document.getElementById('lastname').value.trim();
    const email = document.getElementById('email').value.trim();
    const role = roleSelect.value;
    const fullName = `${firstName} ${lastName}`;

    // Save user info to localStorage
    localStorage.setItem('firstName', firstName);
    localStorage.setItem('lastName', lastName);
    localStorage.setItem('email', email);
    localStorage.setItem('role', role);

    // For students, check if they exist in members.json, if not create them
    if (role === 'student') {
      try {
        // Check if member exists
        const membersResponse = await fetch('/api/members');
        if (membersResponse.ok) {
          const members = await membersResponse.json();
          let member = members.find(m => 
            m.email === email || m.name.toLowerCase() === fullName.toLowerCase()
          );
          
          // If member doesn't exist, create them
          if (!member) {
            const createResponse = await fetch('/api/members', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                firstName,
                lastName,
                email,
                role: 'student'
              })
            });
            
            if (createResponse.ok) {
              member = await createResponse.json();
            }
          }
          
          // Save memberId to localStorage
          if (member) {
            localStorage.setItem('memberId', member.id);
          }
        }
      } catch (error) {
        console.error('Error checking/creating member:', error);
        // Continue with login even if this fails
      }
    }

    form.setAttribute('aria-hidden', 'true');
    form.style.display = 'none';
    successMessage.classList.add('show');

    let target = '../dashboards/student.html';
    if (role === 'professor') {
      target = '../dashboards/professor.html';
    } else if (role === 'Teaching Assistant') {
      target = '../dashboards/ta.html';
    } else if (role === 'team_lead') {
      target = '../dashboards/team_lead.html';
    }

    setTimeout(() => {
      window.location.href = target;
    }, 800);
  });
});
