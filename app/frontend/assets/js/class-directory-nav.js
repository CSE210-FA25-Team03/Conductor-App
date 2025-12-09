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

  // Removed unused functions: fetchCourseMeta and updateCtaContent

  document.addEventListener('DOMContentLoaded', async () => {
    removeCta();
    applyActiveNav();
  });
})();
