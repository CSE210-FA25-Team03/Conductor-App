document.addEventListener("DOMContentLoaded", async () => {
  const me = await fetch("/auth/me").then(res => res.json());

  if (!me.authenticated || me.user.role !== "admin") {
    // not admin → redirect to login
    window.location.href = "/login/";
    return;
  }
  const { upsertClass, upsertUser, getRosterForClass, saveRosterForClass } =
    window.ConductorStorage;
  const form = document.getElementById('adminForm');
  const status = document.getElementById('adminStatus');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const adminEmail = document.getElementById('adminEmail').value.trim();
    const classId = document.getElementById('classId').value.trim();
    const profName = document.getElementById('profName').value.trim();
    const profEmail = document.getElementById('profEmail').value.trim();

    if (!adminEmail || !classId || !profName || !profEmail) {
      status.textContent = 'Please fill in all fields.';
      status.style.color = 'red';
      return;
    }

    // 1) Create / update class
    const classRecord = upsertClass({
      id: classId,
      name: classId,
      professorEmail: profEmail,
      professorName: profName,
      createdBy: adminEmail,
      createdAt: new Date().toISOString(),
    });

    // 2) Create / update professor user
    upsertUser({
      email: profEmail,
      name: profName,
      role: 'professor',
      classId: classRecord.id,
    });

    // 3) Ensure roster has at least the professor in staff list
    const roster = getRosterForClass(classRecord.id);
    const professorAlreadyInStaff = roster.staff.some(
      (s) => s.email.toLowerCase() === profEmail.toLowerCase()
    );

    if (!professorAlreadyInStaff) {
      roster.staff.push({
        email: profEmail,
        pid: '',
        name: profName,
        role: 'professor',
      });
      saveRosterForClass(classRecord.id, roster);
    }

    status.textContent = `Class ${classRecord.id} saved and professor user created.`;
    status.style.color = 'green';
  });
});