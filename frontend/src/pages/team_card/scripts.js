const setupProfilePanel = () => {
  const panel = document.querySelector('.profile-panel');
  if (!panel) return;
  const closeButton = panel.querySelector('.close-profile');
  const triggers = document.querySelectorAll('.profile-trigger');

  const openPanel = (trigger) => {
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }
  };

  const closePanel = () => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    triggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openPanel(trigger);
    });
  });

  closeButton?.addEventListener('click', closePanel);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) {
      closePanel();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePanel();
    }
  });
};

document.addEventListener('DOMContentLoaded', setupProfilePanel);
