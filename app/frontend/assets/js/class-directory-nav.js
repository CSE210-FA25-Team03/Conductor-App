(() => {
  const DIRECTORY_LINK = '/class_directory_student/';

  function ensureCta() {
    // Hide CTA when already inside class directory shell to avoid overlap
    if (document.querySelector('.class-shell')) return null;

    let cta = document.querySelector('.class-directory-cta');
    if (cta) return cta;

    cta = document.createElement('a');
    cta.className = 'class-directory-cta';
    cta.href = DIRECTORY_LINK;
    cta.textContent = 'Class Directory';
    document.body.appendChild(cta);
    return cta;
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
    const cta = ensureCta();
    applyActiveNav();
    const course = await fetchCourseMeta();
    updateCtaContent(cta, course);
  });
})();
