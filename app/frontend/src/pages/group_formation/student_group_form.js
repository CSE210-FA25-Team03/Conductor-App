// student_group_form.js
//
// Student-side group formation:
//   1. Reads the logged-in student's info from localStorage.
//   2. Loads professor-defined skills for the current course.
//   3. Loads THIS student's existing ratings (if any).
//   4. Lets the student rate each skill 1–4 and saves to DB.

(function () {
  const API_BASE = '/api';

  // ------------------------------------------------------------
  // Helpers: current user
  // ------------------------------------------------------------

  function getCurrentUser() {
    // Prefer a full "currentUser" object if you've stored it.
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser'));
      if (stored && stored.email) return stored;
    } catch {
      // ignore
    }

    // Fallback to older keys used elsewhere in the app
    const email = localStorage.getItem('email') || 'student@school.edu';
    const firstName = localStorage.getItem('firstName') || 'Student';
    const lastName = localStorage.getItem('lastName') || 'User';
    const role = localStorage.getItem('role') || 'student';

    return { email, firstName, lastName, role };
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }

    // allow 204
    if (res.status === 204) return null;
    return res.json();
  }

  function setStatus(message, type = '') {
    const el = document.getElementById('gfStatus');
    if (!el) return;

    el.textContent = message || '';
    el.className = 'gf-status';
    if (type) el.classList.add(type); // expects .gf-status.error / .gf-status.success in CSS
  }

  // ------------------------------------------------------------
  // Rendering: skills list
  // ------------------------------------------------------------

  function renderSkills(skills, existingRatingsBySkillId = {}) {
    const container = document.getElementById('skillsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!skills || !skills.length) {
      container.innerHTML = `
        <div class="gf-empty-state">
          Your instructor has not configured any skills yet.<br/>
          Once they add skill requirements, you'll be able to rate yourself here.
        </div>
      `;
      return;
    }

    const sorted = [...skills].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    sorted.forEach((skill) => {
      const row = document.createElement('div');
      row.className = 'skill-row';
      row.dataset.skillId = skill.id;

      const weight =
        typeof skill.weight === 'number'
          ? skill.weight
          : skill.weight != null
          ? Number(skill.weight) || 0
          : 0;

      // Use existing rating if present, otherwise default to 2/4
      let initialRating = existingRatingsBySkillId[skill.id];
      if (!Number.isFinite(initialRating)) {
        initialRating = 2;
      }
      if (initialRating < 1) initialRating = 1;
      if (initialRating > 4) initialRating = 4;

      row.innerHTML = `
        <div class="skill-header">
          <div class="skill-name">${skill.name}</div>
          <div class="skill-weight">
            ${weight ? `Weight: ${weight.toFixed(2)}` : ''}
          </div>
        </div>
        <div class="skill-description">
          ${skill.description || ''}
        </div>
        <div class="skill-rating-row">
          <label>My level (1–4)</label>
          <input
            type="range"
            min="1"
            max="4"
            step="1"
            value="${initialRating}"
            class="skill-rating-input"
          />
          <div class="skill-rating-value">${initialRating} / 4</div>
        </div>
      `;

      const slider = row.querySelector('.skill-rating-input');
      const valueEl = row.querySelector('.skill-rating-value');

      if (slider && valueEl) {
        slider.addEventListener('input', () => {
          valueEl.textContent = `${slider.value} / 4`;
        });
      }

      container.appendChild(row);
    });
  }

  // ------------------------------------------------------------
  // Load skills + this student's ratings
  // ------------------------------------------------------------

  async function loadSkills() {
    try {
      setStatus('Loading skills…');

      const [skills, ratingsBySkillId] = await Promise.all([
        fetchJSON(`${API_BASE}/group-formation/skills`),
        (async () => {
          const currentUser = getCurrentUser();
          const email = (currentUser.email || '').toLowerCase();

          if (!email) return {};

          try {
            const data = await fetchJSON(
              `${API_BASE}/group-formation/student-ratings/me?email=${encodeURIComponent(
                email,
              )}`,
            );
            return data || {};
          } catch {
            return {};
          }
        })(),
      ]);

      renderSkills(Array.isArray(skills) ? skills : [], ratingsBySkillId || {});
      setStatus('');
    } catch (err) {
      console.error('Failed to load skills:', err);
      renderSkills([], {});
      setStatus(
        'Failed to load skills. Please refresh the page or contact your instructor.',
        'error',
      );
    }
  }

  // ------------------------------------------------------------
  // Submit ratings
  // ------------------------------------------------------------

  async function handleSubmit(e) {
    e.preventDefault();

    const currentUser = getCurrentUser();
    const email = (currentUser.email || '').toLowerCase();

    if (!email) {
      setStatus('Missing student email. Please log in again.', 'error');
      return;
    }

    const submitBtn = document.getElementById('gfSubmitBtn');
    const container = document.getElementById('skillsContainer');
    if (!container) return;

    const rows = Array.from(container.querySelectorAll('.skill-row'));

    if (!rows.length) {
      setStatus('There are no skills to rate yet.', 'error');
      return;
    }

    const skillRatings = rows
      .map((row) => {
        const skillId = row.dataset.skillId;
        const slider = row.querySelector('.skill-rating-input');
        if (!skillId || !slider) return null;

        let rating = parseInt(slider.value, 10);
        if (!Number.isFinite(rating)) rating = 2;
        if (rating < 1) rating = 1;
        if (rating > 4) rating = 4;

        return [skillId, rating];
      })
      .filter(Boolean)
      .reduce((acc, [skillId, rating]) => {
        acc[skillId] = rating;
        return acc;
      }, {});

    if (!Object.keys(skillRatings).length) {
      setStatus('Please select a rating for at least one skill.', 'error');
      return;
    }

    try {
      if (submitBtn) submitBtn.disabled = true;
      setStatus('Saving your ratings…');

      await fetchJSON(`${API_BASE}/group-formation/student-ratings`, {
        method: 'POST',
        body: JSON.stringify({
          email,       // <- backend resolves to user_id
          skillRatings,
        }),
      });

      setStatus('Your skill ratings have been saved!', 'success');
    } catch (err) {
      console.error('Failed to save ratings:', err);
      setStatus('Failed to save your ratings. Please try again.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------

  window.addEventListener('DOMContentLoaded', () => {
    const currentUser = getCurrentUser();

    const nameEl = document.getElementById('gfStudentName');
    const emailEl = document.getElementById('gfStudentEmail');

    if (nameEl) {
      const name =
        (currentUser.firstName || '') +
        (currentUser.lastName ? ` ${currentUser.lastName}` : '');
      nameEl.textContent = name.trim() || 'Student';
    }

    if (emailEl) {
      emailEl.textContent = currentUser.email
        ? `· ${currentUser.email}`
        : '';
    }

    const form = document.getElementById('studentSkillsForm');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }

    loadSkills();
  });
})();
