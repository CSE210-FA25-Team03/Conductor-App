// server.js
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory data
let skills = [
  // You can start empty: []
  { id: 1, name: "Java", weight: 5 },
  { id: 2, name: "JavaScript", weight: 5 },
  { id: 3, name: "HTML", weight: 3 },
  { id: 4, name: "Git", weight: 4 },
  { id: 5, name: "Testing", weight: 4 },
  { id: 6, name: "Databases", weight: 3 },
  { id: 7, name: "Public Speaking", weight: 2 }
];

let nextSkillId = skills.length + 1;

// Students: name + ratings per skill (0 = none, 1 = intermediate, 2 = advanced)
let students = [
  // Some sample students
  {
    id: 1,
    name: "Alice",
    ratings: {
      Java: 2,
      JavaScript: 1,
      HTML: 2,
      Git: 1,
      Testing: 1,
      Databases: 0,
      "Public Speaking": 2
    }
  },
  {
    id: 2,
    name: "Bob",
    ratings: {
      Java: 1,
      JavaScript: 2,
      HTML: 1,
      Git: 2,
      Testing: 2,
      Databases: 1,
      "Public Speaking": 0
    }
  },
  {
    id: 3,
    name: "Charlie",
    ratings: {
      Java: 0,
      JavaScript: 1,
      HTML: 2,
      Git: 1,
      Testing: 0,
      Databases: 1,
      "Public Speaking": 1
    }
  }
];

let nextStudentId = students.length + 1;

/*************************************************
 * Helper functions for grouping algorithm
 *************************************************/

// Fisher–Yates shuffle
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createEmptyGroups(numGroups) {
  const groups = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: i + 1,
      students: [],
      skillsScore: {}, // { skillName: totalScoreForSkill }
      totalScore: 0
    });
  }
  return groups;
}

// Add student to a group and update scores based on ratings
function addStudentToGroup(group, student, skills) {
  group.students.push(student);

  skills.forEach(skill => {
    const skillName = skill.name;
    const skillWeight = skill.weight;
    const level = (student.ratings && student.ratings[skillName]) || 0; // 0,1,2

    if (level > 0) {
      const contribution = skillWeight * level;
      if (!group.skillsScore[skillName]) {
        group.skillsScore[skillName] = 0;
      }
      group.skillsScore[skillName] += contribution;
      group.totalScore += contribution;
    }
  });
}

// Sort groups by "need":
// 1) Has space
// 2) Lower totalScore (weaker group first)
// 3) Smaller number of students
// 4) Random tie-break (via shuffle before sort)
function sortGroupsByNeed(groups, groupSize) {
  const shuffledGroups = shuffle(groups);

  return shuffledGroups.sort((a, b) => {
    const aSpace = groupSize - a.students.length;
    const bSpace = groupSize - b.students.length;

    // Prefer groups that still have space
    if (aSpace > 0 && bSpace === 0) return -1;
    if (bSpace > 0 && aSpace === 0) return 1;

    // If both full or both non-full, compare totalScore
    if (aSpace > 0 && bSpace > 0) {
      if (a.totalScore !== b.totalScore) {
        return a.totalScore - b.totalScore; // lower score first
      }

      // If same score, smaller group first
      if (a.students.length !== b.students.length) {
        return a.students.length - b.students.length;
      }
    }

    // Otherwise keep relative order
    return 0;
  });
}

function formGroups(allStudents, groupSize, skills) {
  if (allStudents.length === 0) {
    return [];
  }

  const shuffledStudents = shuffle(allStudents);
  const numGroups = Math.ceil(shuffledStudents.length / groupSize) || 1;
  const groups = createEmptyGroups(numGroups);

  let unassigned = shuffledStudents.slice();

  // For each skill in professor's priority order
  for (const skill of skills) {
    const skillName = skill.name;

    // Students who rated > 0 for this skill
    let candidates = unassigned.filter(
      s => s.ratings && s.ratings[skillName] > 0
    );

    if (candidates.length === 0) {
      continue;
    }

    // Place advanced first, then intermediate
    candidates = candidates.sort(
      (a, b) => b.ratings[skillName] - a.ratings[skillName]
    );

    let groupOrder = sortGroupsByNeed(groups, groupSize);
    let gi = 0;

    for (const student of candidates) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < groupOrder.length) {
        const g = groupOrder[gi];

        if (g.students.length < groupSize) {
          addStudentToGroup(g, student, skills);
          // remove from unassigned
          unassigned = unassigned.filter(s => s.id !== student.id);
          placed = true;
        }

        gi = (gi + 1) % groupOrder.length;
        attempts++;
      }

      // If we couldn't place (all full), stop
      if (!placed) break;
    }
  }

  // Place remaining unassigned students (ignoring skills, just to fill groups)
  for (const student of unassigned) {
    const groupOrder = sortGroupsByNeed(groups, groupSize);
    for (const g of groupOrder) {
      if (g.students.length < groupSize) {
        addStudentToGroup(g, student, skills);
        break;
      }
    }
  }

  return groups;
}

/*************************************************
 * API routes
 *************************************************/

// Skills
app.get("/api/skills", (req, res) => {
  res.json(skills);
});

app.post("/api/skills", (req, res) => {
  const { name, weight } = req.body;

  if (!name || weight == null) {
    return res.status(400).json({ error: "name and weight are required" });
  }

  const numericWeight = Number(weight);
  if (Number.isNaN(numericWeight) || numericWeight <= 0) {
    return res.status(400).json({ error: "weight must be a positive number" });
  }

  const already = skills.find(
    s => s.name.toLowerCase() === name.trim().toLowerCase()
  );
  if (already) {
    return res.status(400).json({ error: "Skill with this name already exists" });
  }

  const newSkill = {
    id: nextSkillId++,
    name: name.trim(),
    weight: numericWeight
  };
  skills.push(newSkill);

  res.json(newSkill);
});

// Students
app.get("/api/students", (req, res) => {
  res.json(students);
});

app.post("/api/students", (req, res) => {
  const { name, ratings } = req.body;

  if (!name || !ratings) {
    return res
      .status(400)
      .json({ error: "name and ratings (per skill) are required" });
  }

  // Ensure ratings match existing skills, defaulting invalid values to 0
  const cleanRatings = {};
  skills.forEach(skill => {
    const val = ratings[skill.name];
    const level = Number(val);
    cleanRatings[skill.name] =
      !Number.isNaN(level) && level >= 0 && level <= 2 ? level : 0;
  });

  const newStudent = {
    id: nextStudentId++,
    name: name.trim(),
    ratings: cleanRatings
  };

  students.push(newStudent);
  res.json(newStudent);
});

// Group formation
app.post("/api/form-groups", (req, res) => {
  const groupSize = Number(req.body.groupSize) || 4;

  if (students.length === 0) {
    return res
      .status(400)
      .json({ error: "No students available to form groups." });
  }
  if (skills.length === 0) {
    return res.status(400).json({ error: "No skills defined." });
  }

  const groups = formGroups(students, groupSize, skills);
  res.json({
    groupSize,
    totalStudents: students.length,
    totalGroups: groups.length,
    skills,
    groups
  });
});

// Basic HTML routes (optional, since we serve static from /public)
app.get("/professor", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "professor.html"));
});

app.get("/student", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "student.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
