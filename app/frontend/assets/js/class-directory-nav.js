(() => {
  // CTA removal: dashboard now has a dedicated card, so suppress the floating shortcut.
  function removeCta() {
    document.querySelectorAll('.class-directory-cta').forEach((cta) => cta.remove());
  }

  function applyActiveNav() {
    const shell = document.querySelector('.class-shell');
    if (!shell) return;
    const activePage = shell.dataset.page;
    if (!activePage) return;
    document.querySelectorAll('.class-nav-item').forEach((item) => {
      const target = item.dataset.page;
      if (target === activePage) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  async function fetchCourseMeta() {
    try {
      const res = await fetch('/api/class_directory');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : data;
      return entry?.course || null;
    } catch (error) {
      console.error('Failed to load course meta for CTA', error);
      return null;
    }
  }

  function updateCtaContent(cta, course) {
    if (!cta || !course) return;
    const code = course.course_code || 'Class';
    const term = course.term_year || '';
    cta.innerHTML = `${code}<br>${term || 'Directory'}`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    removeCta();
    applyActiveNav();
  });
})();
