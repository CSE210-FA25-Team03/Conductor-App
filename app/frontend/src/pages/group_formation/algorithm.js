window.GroupAlgo = (function () {
  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formGroups(allStudents, groupSize, requiredSkills) {
    const skillWeightMap = requiredSkills.reduce((map, s) => {
      map[s.name] = s.weight;
      return map;
    }, {});

    function createEmptyGroups(numGroups) {
      const groups = [];
      for (let i = 0; i < numGroups; i++) {
        groups.push({
          id: i + 1,
          students: [],
          skillsCount: {},
          score: 0,
        });
      }
      return groups;
    }

    function addStudentToGroup(group, student) {
      group.students.push(student);
      (student.skills || []).forEach((skill) => {
        if (!group.skillsCount[skill]) {
          group.skillsCount[skill] = 0;
        }
        group.skillsCount[skill] += 1;
        const weight = skillWeightMap[skill] || 0;
        group.score += weight;
      });
    }

    function sortGroupsByNeed(groups) {
      const shuffled = shuffle(groups);
      return shuffled.sort((a, b) => {
        const aSpace = groupSize - a.students.length;
        const bSpace = groupSize - b.students.length;
        if (aSpace === 0 && bSpace > 0) return 1;
        if (bSpace === 0 && aSpace > 0) return -1;
        if (aSpace === 0 && bSpace === 0) return 0;
        if (a.score !== b.score) return a.score - b.score;
        if (a.students.length !== b.students.length) {
          return a.students.length - b.students.length;
        }
        return 0;
      });
    }

    const shuffledStudents = shuffle(allStudents);
    const numGroups = Math.ceil(shuffledStudents.length / groupSize);
    const groups = createEmptyGroups(numGroups);

    let unassigned = shuffledStudents.slice();

    for (const skillObj of requiredSkills) {
      const skillName = skillObj.name;
      let candidates = unassigned.filter((s) =>
        (s.skills || []).includes(skillName)
      );
      if (!candidates.length) continue;
      candidates = shuffle(candidates);
      const groupOrder = sortGroupsByNeed(groups);
      let groupIndex = 0;
      for (const student of candidates) {
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
          unassigned = unassigned.filter((s) => s.id !== student.id);
        } else {
          break;
        }
      }
    }

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

  function formGroupsRandom(allStudents, groupSize) {
    const shuffled = shuffle(allStudents);
    const numGroups = Math.ceil(shuffled.length / groupSize);
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        id: i + 1,
        students: [],
      });
    }
    shuffled.forEach((student, idx) => {
      groups[idx % numGroups].students.push(student);
    });
    return groups;
  }

  return {
    formGroups,
    formGroupsRandom,
  };
})();