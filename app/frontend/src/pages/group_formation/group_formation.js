/* =======================================================
   Dummy Data (fallback only)
======================================================= */


const dummyStudents = [
  {
    id: 1,
    name: "Alice Johnson",
    email: "alice@school.edu",
    ratings: { Java: 2, JavaScript: 3, HTML: 1 }
  },
  {
    id: 2,
    name: "Bob Lee",
    email: "bob@school.edu",
    ratings: { Java: 3, JavaScript: 1, HTML: 2 }
  },
  {
    id: 3,
    name: "Charlie Kim",
    email: "charlie@school.edu",
    ratings: { Java: 1, JavaScript: 4, HTML: 3 }
  }
];

const dummyTAs = ["Sam Taylor", "Diana Chen"];

/* =======================================================
   State
======================================================= */

let skills = []; // Will load from localStorage or default

/* =======================================================
   DOM
======================================================= */

const skillsTableBody = document.querySelector("#skillsTable tbody");
const studentsTableBody = document.querySelector("#studentsTable tbody");
const taTableBody = document.querySelector("#taTable tbody");
const groupsDiv = document.getElementById("groupResults");

/* =======================================================
   Load Skills (from localStorage or default)
======================================================= */

function loadSkills() {
  skills = JSON.parse(localStorage.getItem("skills")) || [];

  skillsTableBody.innerHTML = "";
  skills.forEach((s, i) => {
    skillsTableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.weight}</td>
        <td>
          <button class="delete-skill-btn" data-index="${i}" title="Delete">
            <span class="trash-icon">&#128465;</span>
          </button>
        </td>
      </tr>`;
  });
// Delete skill handler (moved outside loadSkills to avoid multiple bindings)
}

/* =======================================================
   Load Students
======================================================= */

function loadStudents() {
  studentsTableBody.innerHTML = "";

  // Get submitted ratings from localStorage
  const submitted = JSON.parse(localStorage.getItem('studentRatings')) || [];
  // Merge dummyStudents and submitted ratings
  const allStudents = [...dummyStudents];
  submitted.forEach(sub => {
    // If already in dummyStudents, update ratings
    const idx = allStudents.findIndex(s => s.email === sub.email);
    if (idx !== -1) {
      allStudents[idx].ratings = sub.ratings;
      allStudents[idx].name = sub.name;
    } else {
      allStudents.push({ id: allStudents.length + 1, name: sub.name, email: sub.email, ratings: sub.ratings });
    }
  });

  allStudents.forEach((s, i) => {
    const ratingStr = Object.entries(s.ratings)
      .map(([skill, level]) => `${skill}: ${level}`)
      .join(", ");

    studentsTableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.email}</td>
        <td>${ratingStr}</td>
      </tr>`;
  });
}

/* =======================================================
   Load TAs
======================================================= */

function loadTAs() {
  taTableBody.innerHTML = "";

  dummyTAs.forEach((ta, i) => {
    taTableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${ta}</td>
        <td>${ta.toLowerCase().replace(/ /g, ".")}@school.edu</td>
      </tr>`;
  });
}

/* =======================================================
   Add Skill
======================================================= */

document.getElementById("addSkillBtn").addEventListener("click", () => {
  const nameInput = document.getElementById("skillName");
  const weightInput = document.getElementById("skillWeight");
  const name = nameInput.value.trim();
  const weight = Number(weightInput.value);

  if (!name) {
    alert("Enter a skill name!");
    return;
  }
  if (!weight || weight < 1) {
    alert("Enter a valid weight!");
    return;
  }

  skills.push({ name, weight });
  localStorage.setItem("skills", JSON.stringify(skills));
  loadSkills();

  // Clear inputs
  nameInput.value = "";
  weightInput.value = "5";
});

/* =======================================================
   Save Skills
======================================================= */

document.getElementById("saveSkillsBtn").addEventListener("click", () => {
  localStorage.setItem("skills", JSON.stringify(skills));
  alert("Skills saved!");
});

/* =======================================================
   Group Algorithm
======================================================= */

function calculateScore(student) {
  return skills.reduce((sum, s) => {
    const rating = student.ratings[s.name] || 0;
    return sum + rating * s.weight;
  }, 0);
}

function generateGroups() {
  groupsDiv.innerHTML = "";
  const size = Number(document.getElementById("groupSize").value);

  if (!size || size <= 0) {
    alert("Enter a valid group size!");
    return;
  }

  const sorted = dummyStudents
    .map(s => ({ ...s, score: calculateScore(s) }))
    .sort((a, b) => b.score - a.score);

  const groups = [];

  sorted.forEach(student => {
    let best = null;
    let lowest = Infinity;

    groups.forEach(g => {
      if (g.members.length < size && g.total < lowest) {
        best = g;
        lowest = g.total;
      }
    });

    if (!best) {
      best = { members: [], total: 0 };
      groups.push(best);
    }

    best.members.push(student);
    best.total += student.score;
  });

  groups.forEach((g, i) => {
    let html = `
      <div class="panel">
        <h3>Group ${i + 1}</h3>
        <p><strong>Total Score:</strong> ${g.total}</p>
        <ul>`;

    g.members.forEach(m => {
      html += `<li>${m.name} — Score: ${m.score}</li>`;
    });

    html += `</ul></div>`;

    groupsDiv.innerHTML += html;
  });
}
document.getElementById("generateBtn").addEventListener("click", generateGroups);

/* =======================================================
   Initialize Page
======================================================= */

loadSkills();
loadStudents();
loadTAs();
