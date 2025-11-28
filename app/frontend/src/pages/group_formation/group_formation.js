/* =======================================================
   CLEANED GROUP FORMATION JS
   All syntax errors fixed, no duplicate declarations
======================================================= */

/* =============================
   Dummy Data (fallback only)
============================= */

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

/* =============================
   Global State
============================= */

let skills = JSON.parse(localStorage.getItem("skills")) || [];

/* =============================
   DOM References
============================= */

const skillsTableBody = document.querySelector("#skillsTable tbody");
const studentsTableBody = document.querySelector("#studentsTable tbody");
const taTableBody = document.querySelector("#taTable tbody");
const groupsTableBody = document.getElementById("groupsTableBody");
// const groupsDiv = document.getElementById("groupResults");

/* =============================
   Utility
============================= */

function showError(msg) {
  const box = document.getElementById("errorBox");
  box.textContent = msg;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 3000);
}

/* =============================
   Load Skills Table
============================= */

function loadSkills() {
  skillsTableBody.innerHTML = "";

  skills.forEach((s, i) => {
    skillsTableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.weight}</td>
        <td><button class="delete-btn" data-index="${i}">Delete</button></td>
      </tr>
    `;
  });

  // Delete skill handler
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = e.target.dataset.index;
      skills.splice(idx, 1);
      localStorage.setItem("skills", JSON.stringify(skills));
      loadSkills();
    });
  });
}

/* =============================
   Load Students Table
============================= */

function loadStudents() {
  studentsTableBody.innerHTML = "";

  const submitted = JSON.parse(localStorage.getItem("studentRatings")) || [];
  const allStudents = [...dummyStudents];

  submitted.forEach(sub => {
    const idx = allStudents.findIndex(s => s.email === sub.email);
    if (idx !== -1) {
      allStudents[idx].ratings = sub.ratings;
      allStudents[idx].name = sub.name;
    } else {
      allStudents.push({
        id: allStudents.length + 1,
        name: sub.name,
        email: sub.email,
        ratings: sub.ratings
      });
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
      </tr>
    `;
  });
}

/* =============================
   Load TA Table
============================= */

function loadTAs() {
  taTableBody.innerHTML = "";

  dummyTAs.forEach((ta, i) => {
    taTableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${ta}</td>
        <td>${ta.toLowerCase().replace(/ /g, ".")}@school.edu</td>
      </tr>
    `;
  });
}

/* =============================
   Add Skill
============================= */

document.getElementById("addSkillBtn").addEventListener("click", () => {
  const name = document.getElementById("skillName").value.trim();
  const weight = Number(document.getElementById("skillWeight").value);

  if (!name) return showError("Please enter a skill name.");
  if (!weight || weight < 1) return showError("Skill weight must be 1–10.");

  skills.push({ name, weight });
  localStorage.setItem("skills", JSON.stringify(skills));

  loadSkills();

  document.getElementById("skillName").value = "";
  document.getElementById("skillWeight").value = 5;
});

/* =============================
   Save Skills
============================= */

document.getElementById("saveSkillsBtn").addEventListener("click", () => {
  localStorage.setItem("skills", JSON.stringify(skills));
  alert("Skills saved!");
});

/* =============================
   TA Assignment
============================= */

function assignTAsToGroups(groups, tasList) {
  if (!tasList.length) return groups;

  return groups.map((g, i) => ({
    ...g,
    taEmail: tasList[i % tasList.length]
  }));
}

/* =============================
   table renderer
============================= */

function renderGroupsTable(groups) {
  groupsTableBody.innerHTML = "";

  if (!groups || groups.length === 0) {
    groupsTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#777;">No groups yet.</td>
      </tr>
    `;
    return;
  }

  groups.forEach((g, i) => {
    (g.members || []).forEach((m) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${m.name}</td>
        <td>${m.email}</td>
        <td>${m.pid || ""}</td>
        <td>Team ${g.id || i + 1}</td>
        <td>${m.role || "member"}</td>
        <td>${g.taEmail || ""}</td>
      `;

      groupsTableBody.appendChild(row);
    });
  });
}

/* =============================
   Smart Group Generate
============================= */

function smartGenerateGroups() {
  const size = Number(document.getElementById("groupSize").value);
  if (!size || size <= 0) return alert("Enter a valid group size.");

  const students = dummyStudents.map(s => ({
    ...s,
    skills: Object.keys(s.ratings)
  }));

  const tasList = dummyTAs.map(
    ta => ta.toLowerCase().replace(/ /g, ".") + "@school.edu"
  );

  const groups = window.GroupAlgo.formGroups(students, size, skills);
  const groupsWithTAs = assignTAsToGroups(groups, tasList);

  const tableGroups = groupsWithTAs.map(g => ({
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

document.getElementById("generateBtn").addEventListener("click", smartGenerateGroups);

/* =============================
   Random Group Generate
============================= */

function randomGenerateGroups() {
  const size = Number(document.getElementById("groupSize").value);
  if (!size || size <= 0) return alert("Enter a valid group size.");

  const students = dummyStudents.map(s => ({
    ...s,
    skills: Object.keys(s.ratings)
  }));

  const tasList = dummyTAs.map(
    ta => ta.toLowerCase().replace(/ /g, ".") + "@school.edu"
  );

  const groups = window.GroupAlgo.formGroupsRandom(students, size) || [];
  const groupsWithTAs = assignTAsToGroups(groups, tasList);

  const tableGroups = groupsWithTAs.map(g => ({
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

document.getElementById("randomizeBtn").addEventListener("click", randomGenerateGroups);

/* =============================
   INITIAL LOAD
============================= */

window.addEventListener("DOMContentLoaded", () => {
  loadSkills();
  loadStudents();
  loadTAs();
});
