document.addEventListener("DOMContentLoaded", async () => {
  const me = await fetch("/auth/me").then(res => res.json());

  // if (!me.authenticated || me.user.role !== "admin") {
  //   // not admin → redirect to login
  //   window.location.href = "/login/";
  //   return;
  // }
  const form = document.getElementById('adminForm');
  const status = document.getElementById('adminStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.style.color = '';

    const courseCode = document.getElementById('courseCode').value.trim();
    const profFirst = document.getElementById('profFirst').value.trim();
    const profLast = document.getElementById('profLast').value.trim();
    const profEmail = document.getElementById('profEmail').value.trim();

    if (!courseCode || !profFirst || !profLast || !profEmail) {
      status.textContent = 'Please fill in all fields.';
      status.style.color = 'red';
      return;
    }

    try {
      const resp = await fetch('/api/admin/course-professor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseCode, profFirst, profLast, profEmail }),
      });

      const text = await resp.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, message: text };
      }

      if (!resp.ok || !data.success) {
        const msg = data.message || data.error || `Request failed (${resp.status})`;
        status.textContent = msg;
        status.style.color = 'red';
        return;
      }

      status.textContent = data.message || 'Success';
      status.style.color = (data.message && data.message.includes('already')) ? '#a15c00' : 'green';
    } catch (err) {
      console.error('Admin submit error:', err);
      status.textContent = err?.message || 'Unexpected error. Please try again.';
      status.style.color = 'red';
    }
  });
});