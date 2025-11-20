/**************************************************************
 * CONFIGURATION
 **************************************************************/

// Easy to change: desired group size
const GROUP_SIZE = 4;

// Professor's required skills + priorities (weights)
// Higher weight = more important skill
const requiredSkills = [
  { name: "Java",           weight: 5 },
  { name: "JavaScript",     weight: 5 },
  { name: "Git",            weight: 4 },
  { name: "Testing",        weight: 4 },
  { name: "Databases",      weight: 3 },
  { name: "HTML",           weight: 3 },
  { name: "System Design",  weight: 3 },
  { name: "UML Modeling",   weight: 2 },
  { name: "Public Speaking",weight: 2 },
  { name: "Technical Writing", weight: 2 },
  { name: "Leadership",     weight: 3 }
];

// Dummy student data for a software engineering class.
// Each student has a name and a list of skills.
const students = [
  { id: 1,  name: "Alice",   skills: ["Java", "HTML", "Git", "Public Speaking"] },
  { id: 2,  name: "Bob",     skills: ["Java", "JavaScript", "Git", "Testing"] },
  { id: 3,  name: "Charlie", skills: ["JavaScript", "HTML", "CSS", "Databases"] },
  { id: 4,  name: "Diana",   skills: ["Java", "Git", "Testing", "System Design"] },
  { id: 5,  name: "Eve",     skills: ["JavaScript", "Git", "Public Speaking"] },
  { id: 6,  name: "Frank",   skills: ["Java", "Databases", "Testing"] },
  { id: 7,  name: "Grace",   skills: ["HTML", "CSS", "Technical Writing"] },
  { id: 8,  name: "Heidi",   skills: ["JavaScript", "Git", "Databases"] },
  { id: 9,  name: "Ivan",    skills: ["Java", "System Design", "Leadership"] },
  { id: 10, name: "Judy",    skills: ["JavaScript", "UML Modeling", "Testing"] },
  { id: 11, name: "Karl",    skills: ["Java", "Git", "Databases", "Leadership"] },
  { id: 12, name: "Laura",   skills: ["HTML", "JavaScript", "Technical Writing"] },
  { id: 13, name: "Mallory", skills: ["Java", "Testing", "Databases"] },
  { id: 14, name: "Niaj",    skills: ["JavaScript", "Git", "UML Modeling"] },
  { id: 15, name: "Olivia",  skills: ["Java", "Git", "Public Speaking", "Leadership"] },
  { id: 16, name: "Peggy",   skills: ["JavaScript", "HTML", "Testing"] },
  { id: 17, name: "Quentin", skills: ["Java", "Databases", "System Design"] },
  { id: 18, name: "Rupert",  skills: ["JavaScript", "Git", "Technical Writing"] },
  { id: 19, name: "Sybil",   skills: ["Java", "UML Modeling", "Testing"] },
  { id: 20, name: "Trent",   skills: ["Databases", "System Design", "Leadership"] },
  { id: 21, name: "Uma",     skills: ["Java", "Git"] },
  { id: 22, name: "Victor",  skills: ["JavaScript", "Public Speaking"] },
  { id: 23, name: "Wendy",   skills: ["Java", "System Design", "Technical Writing"] },
  { id: 24, name: "Xavier",  skills: ["Git", "Testing", "Databases"] },
  { id: 25, name: "Yvonne",  skills: ["HTML", "JavaScript", "Public Speaking"] },
  { id: 26, name: "Zack",    skills: ["Java", "Git", "Databases"] },
  { id: 27, name: "Adam",    skills: ["JavaScript", "System Design"] },
  { id: 28, name: "Bella",   skills: ["Java", "Testing", "Public Speaking"] },
  { id: 29, name: "Cindy",   skills: ["HTML", "Technical Writing"] },
  { id: 30, name: "Derek",   skills: ["Leadership", "UML Modeling"] }
];

/**************************************************************
 * HELPER FUNCTIONS
 **************************************************************/

// Fisher-Yates shuffle for randomness
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a quick lookup for skill weight by name
const skillWeightMap = requiredSkills.reduce((map, s) => {
  map[s.name] = s.weight;
  return map;
}, {});

// Initialize empty groups
function createEmptyGroups(numGroups) {
  const groups = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: i + 1,
      students: [],
      skillsCount: {}, // e.g. { "Java": 2, "Git": 1 }
      score: 0         // weighted skill presence score
    });
  }
  return groups;
}

// Update group stats when adding a student
function addStudentToGroup(group, student) {
  group.students.push(student);
  // For each of the student's skills, increase skill count + score
  student.skills.forEach(skill => {
    if (!group.skillsCount[skill]) {
      group.skillsCount[skill] = 0;
    }
    group.skillsCount[skill] += 1;

    const weight = skillWeightMap[skill] || 0;

    // Simple scoring: reward presence of this skill in this group
    // You can tweak: e.g. only add weight when skill first appears
    group.score += weight;
  });
}

// Sort groups for assignment of next skill:
// 1) Groups with available space
// 2) Lower score (weaker groups first)
// 3) Smaller size
// 4) Random tie-break
function sortGroupsByNeed(groups) {
  const shuffled = shuffle(groups); // for fair tie-breaking
  return shuffled.sort((a, b) => {
    const aSpace = GROUP_SIZE - a.students.length;
    const bSpace = GROUP_SIZE - b.students.length;

    if (aSpace === 0 && bSpace > 0) return 1;
    if (bSpace === 0 && aSpace > 0) return -1;
    if (aSpace === 0 && bSpace === 0) {
      // both full, keep relative order
      return 0;
    }

    // Both have space; sort by score, then by size
    if (a.score !== b.score) return a.score - b.score;
    if (a.students.length !== b.students.length) {
      return a.students.length - b.students.length;
    }
    return 0;
  });
}

/**************************************************************
 * CORE ALGORITHM
 **************************************************************/

function formGroups(allStudents, groupSize, requiredSkills) {
  // Shuffle students to avoid bias by input order
  const shuffledStudents = shuffle(allStudents);

  const numGroups = Math.ceil(shuffledStudents.length / groupSize);
  const groups = createEmptyGroups(numGroups);

  // Copy: we'll remove students as they get assigned
  let unassigned = shuffledStudents.slice();

  // For each skill in professor's priority list
  for (const skillObj of requiredSkills) {
    const skillName = skillObj.name;
    const skillWeight = skillObj.weight;

    // Take all unassigned students who have this skill
    let candidates = unassigned.filter(s => s.skills.includes(skillName));

    if (candidates.length === 0) {
      // No one has this skill; skip
      continue;
    }

    // Randomize candidates so we don't always bias earlier ones
    candidates = shuffle(candidates);

    // Sort groups by need (weaker groups first)
    const groupOrder = sortGroupsByNeed(groups);

    // Assign candidates to groups in round-robin over the "needy" order
    let groupIndex = 0;
    for (const student of candidates) {
      // Find the next group with space
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < groupOrder.length) {
        const g = groupOrder[groupIndex];
        if (g.students.length < groupSize) {
          addStudentToGroup(g, student);
          placed = true;
        }
        groupIndex = (groupIndex + 1) % groupOrder.length;
        attempts++;
      }
      if (placed) {
        // Remove from unassigned
        unassigned = unassigned.filter(s => s.id !== student.id);
      } else {
        // All groups full; break early
        break;
      }
    }

    // Optional: you could recompute group scores here if you use
    // a more complex scoring strategy.
  }

  // Any remaining unassigned students: place them just to fill groups,
  // still preferring lower-score / smaller groups
  if (unassigned.length > 0) {
    for (const student of unassigned) {
      const groupOrder = sortGroupsByNeed(groups);
      for (const g of groupOrder) {
        if (g.students.length < groupSize) {
          addStudentToGroup(g, student);
          break;
        }
      }
    }
  }

  return groups;
}

/**************************************************************
 * RUN + PRETTY PRINT
 **************************************************************/

function summarizeGroup(group) {
  const skillsSummary = {};
  for (const [skill, count] of Object.entries(group.skillsCount)) {
    // Only show skills that appear in professor's list, to keep output readable
    if (skillWeightMap[skill]) {
      skillsSummary[skill] = count;
    }
  }
  return skillsSummary;
}

function printGroups(groups) {
  console.log(`\n=== Group Formation Result (group size = ${GROUP_SIZE}) ===\n`);

  groups.forEach(group => {
    console.log(`Group ${group.id}:`);
    console.log("  Members:");
    group.students.forEach(s => {
      console.log(`    - ${s.name} (${s.skills.join(", ")})`);
    });
    console.log("  Group size:", group.students.length);
    console.log("  Skill counts (for prioritized skills):", summarizeGroup(group));
    console.log("  Group score:", group.score);
    console.log("--------------------------------------------------");
  });
}

// Actually form the groups and print them
const groups = formGroups(students, GROUP_SIZE, requiredSkills);
printGroups(groups);
