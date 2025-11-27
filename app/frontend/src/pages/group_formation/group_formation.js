// Table-based group rendering logic for group formation page
function renderGroupsTable(groups) {
  const groupsTableBody = document.getElementById("groupsTableBody");
  if (!groupsTableBody) return;
  groupsTableBody.innerHTML = "";

  if (!groups || !groups.length) {
    groupsTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#777;font-size:0.9rem;">No groups yet. Form groups using the buttons above.</td>
      </tr>
    `;
    return;
  }

  groups.forEach((g, i) => {
    (g.members || g.students || []).forEach((s) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = s.name || s.email || "";
      const emailTd = document.createElement("td");
      emailTd.textContent = s.email || "";
      const pidTd = document.createElement("td");
      pidTd.textContent = s.pid || "";
      const groupTd = document.createElement("td");
      groupTd.textContent = `Team ${g.id || i + 1}`;
      const roleTd = document.createElement("td");
      roleTd.textContent = s.role || "member";
      const taTd = document.createElement("td");
      taTd.textContent = g.taEmail || "";
      tr.appendChild(nameTd);
      tr.appendChild(emailTd);
      tr.appendChild(pidTd);
      tr.appendChild(groupTd);
      tr.appendChild(roleTd);
      tr.appendChild(taTd);
      groupsTableBody.appendChild(tr);
    });
  });
}

function assignTAsToGroups(groups, tasList) {
  if (!tasList || !tasList.length) return groups;
  return groups.map((g, idx) => {
    const ta = tasList[idx % tasList.length];
    return { ...g, taEmail: ta };
  });
}

function generateGroups() {
  const size = Number(document.getElementById("groupSize").value);
  if (!size || size <= 0) {
    alert("Enter a valid group size!");
    return;
  }
  // Use dummyStudents for demo; replace with real students if available
  // Use skills for weighting
  // For demo, assign all students as 'member', assign TAs
  // Ensure students have .skills property for algorithm.js
  const students = dummyStudents.map(s => ({
    ...s,
    skills: Object.keys(s.ratings || {})
  }));
  const tasList = dummyTAs.map(ta => ta.toLowerCase().replace(/ /g, ".") + "@school.edu");
  let groups = window.GroupAlgo.formGroups(students, size, skills);
  groups = assignTAsToGroups(groups, tasList);
  // Flatten for table rendering
  const tableGroups = groups.map(g => ({
    id: g.id,
    members: g.students.map(s => ({
      name: s.name,
      email: s.email,
      pid: s.pid || "",
      role: s.role || "member"
    })),
    taEmail: g.taEmail
  }));
  renderGroupsTable(tableGroups);
}
document.getElementById("generateBtn").addEventListener("click", generateGroups);

function generateRandomGroups() {
  const size = Number(document.getElementById("groupSize").value);
  if (!size || size <= 0) {
    alert("Enter a valid group size!");
    return;
  }
  const students = dummyStudents.map(s => ({
    ...s,
    skills: Object.keys(s.ratings || {})
  }));
  const tasList = dummyTAs.map(ta => ta.toLowerCase().replace(/ /g, ".") + "@school.edu");
  let groups = window.GroupAlgo.formGroupsRandom ? window.GroupAlgo.formGroupsRandom(students, size) : [];
  groups = assignTAsToGroups(groups, tasList);
  const tableGroups = groups.map(g => ({
    id: g.id,
    members: g.students.map(s => ({
      name: s.name,
      email: s.email,
      pid: s.pid || "",
      role: s.role || "member"
    })),
    taEmail: g.taEmail
  }));
  renderGroupsTable(tableGroups);
}
document.getElementById("randomizeBtn").addEventListener("click", generateRandomGroups);
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
function showError(msg) {
  const box = document.getElementById("errorBox");
  box.textContent = msg;
  box.classList.add("show");

  // Auto-hide after 3 seconds
  setTimeout(() => {
    box.classList.remove("show");
  }, 3000);
}


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

  document.querySelectorAll(".delete-skill-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const idx = Number(btn.getAttribute("data-index"));
      skills.splice(idx, 1);
      localStorage.setItem("skills", JSON.stringify(skills));
      loadSkills();
    });
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
    showError("Please enter a skill name.");
    return;
  }

  if (!weight || weight < 1) {
    showError("Please enter a valid skill weight (1–10).");
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
