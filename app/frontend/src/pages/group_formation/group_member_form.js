// Group Member Group Formation Form Logic
const skillsInputsDiv = document.getElementById('skillsInputs');
const form = document.getElementById('memberSkillForm');
const submitMessage = document.getElementById('submitMessage');
const formTitle = document.getElementById('formTitle');
const formHeader = document.getElementById('formHeader');

// Detect role: student or team_lead
let role = localStorage.getItem('role') || 'student';
if (window.location.search.includes('role=team_lead')) role = 'team_lead';

// Set dynamic title/header
if (role === 'team_lead') {
  formTitle.textContent = 'Group Formation | Team Lead';
  formHeader.textContent = 'Rate Your Skills (Team Lead)';
} else {
  formTitle.textContent = 'Group Formation | Student';
  formHeader.textContent = 'Rate Your Skills (Student)';
}

// Load skills from backend
let skills = [];
fetch('/api/group-formation/skills')
  .then(res => res.json())
  .then(data => {
    skills = data || [];
    renderSkillInputs();
  });

function renderSkillInputs() {
  skillsInputsDiv.innerHTML = '';
  skills.forEach((skill, i) => {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <span class="skill-label">${skill.name} (${skill.weight})</span>
      <input type="number" class="skill-input" name="skill_${i}" min="1" max="10" required placeholder="Rating" />
    `;
    skillsInputsDiv.appendChild(row);
  });
}

form.addEventListener('submit', function(e) {
  e.preventDefault();
  // Collect ratings
  const ratings = {};
  skills.forEach((skill, i) => {
    const val = form.elements[`skill_${i}`].value;
    ratings[skill.name] = Number(val);
  });
  // Use email/name from localStorage or prompt
  let email = localStorage.getItem('email') || prompt('Enter your email:');
  let name = (localStorage.getItem('firstName') || '') + ' ' + (localStorage.getItem('lastName') || '');
  if (!email) return alert('Email required!');
  // Submit to backend
  const endpoint = role === 'team_lead' ? '/api/group-formation/team-lead-ratings' : '/api/group-formation/student-ratings';
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, ratings })
  }).then(() => {
    submitMessage.style.display = 'block';
    form.style.display = 'none';
  });
});
