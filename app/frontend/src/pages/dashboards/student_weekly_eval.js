// student_weekly_eval.js
//
// Populates the student weekly evaluation drawer with:
// - Evaluation reports (if any)
// - Public instructor notes (eval_notes.visibility = 'shared')
// - Work journals with instructor replies

(function () {
  const API_BASE = '/api';

  function getCurrentUser() {
    // Preferred: single currentUser blob
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser'));
      if (stored && stored.email) return stored;
    } catch {
      // ignore
    }

    // Fallback: older keys
    const email =
      localStorage.getItem('email') || 'student@school.edu';
    const firstName =
      localStorage.getItem('firstName') || 'Student';
    const lastName =
      localStorage.getItem('lastName') || 'User';
    const role =
      localStorage.getItem('role') || 'student';

    return {
      email,
      firstName,
      lastName,
      role,
    };
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
  }

  function selectEl(selector) {
    return document.querySelector(selector);
  }

  // Summary is removed for student view per new design
  function renderSummary(container) {
    if (!container) return;
    container.innerHTML = '';
  }

  function renderMoodAndWeekFilter(data) {
    const weekSelect = selectEl('[data-week-filter]');
    const evalNotesP = selectEl('[data-eval-notes]');
    const headerContext = selectEl('[data-eval-context]');

    const name = data.member?.name || data.member?.email || 'Student';
    const teamName = data.member?.teamName || null;

    if (headerContext) {
      headerContext.textContent = teamName
        ? `${name} · ${teamName}`
        : name;
    }

    // const reports = Array.isArray(data.evalReports) ? data.evalReports : [];

    // Populate week dropdown explicitly 1..10
    if (weekSelect) {
      weekSelect.innerHTML = '';
      // Add blank placeholder so dropdown opens empty
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '';
      weekSelect.appendChild(blank);

      for (let i = 1; i <= 10; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `Week ${i}`;
        weekSelect.appendChild(opt);
      }
      weekSelect.selectedIndex = 0; // select blank
    }

    function applyReport(report) {
      if (!evalNotesP) return;
      const items = Array.isArray(report?.items) ? report.items : [];
      if (!items.length) {
        evalNotesP.innerHTML = '';
        return;
      }
      const html = items.map(it => {
        const icon = it.face || '😐';
        const statusText = it.status || 'normal';
        const publicText = it.publicText ? `Public: ${it.publicText}` : 'Public: —';
        const ts = it.createdAt ? new Date(it.createdAt).toLocaleString() : '';
        const fromRole = it.authorRole ? `From: ${it.authorRole}` : '';
        return `
          <div class="weekly-eval-grid" style="border:1px solid #ddd;border-radius:8px;padding:8px;margin:6px 0;display:grid;grid-template-columns:1fr 2fr;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.2rem;">${icon}</span>
              <span style="text-transform:capitalize;">${statusText}</span>
            </div>
            <div>
              ${fromRole ? `<div style="font-weight:600;">${fromRole}</div>` : ''}
              <div>${publicText}</div>
              ${ts ? `<div style="color:#666;font-size:0.85rem;">${ts}</div>` : ''}
            </div>
          </div>`;
      }).join('');
      evalNotesP.innerHTML = html;
    }

    // Initial state: empty until user picks a week
    applyReport(null);

    // If weeks exist, wire up change event
    if (weekSelect) {
      weekSelect.addEventListener('change', async () => {
        const value = parseInt(weekSelect.value, 10);
        if (!Number.isFinite(value)) {
          applyReport(null);
          return;
        }
        // Fetch evaluation journal notes for selected week and build grids
        try {
          const notes = await fetchJSON(`${API_BASE}/eval-notes?email=${encodeURIComponent((data.member?.email || data.user?.email || '').toLowerCase())}&week=${value}`);
          const items = Array.isArray(notes) ? notes.map(n => {
            const scores = n.scores || {};
            const total = typeof scores.total === 'number' ? scores.total : (Number(scores.total) || 0);
            function rubricStatus(t) {
              const x = typeof t === 'number' ? t : Number(t) || 0;
              if (x <= 5) return 'off-track';
              if (x <= 10) return 'normal';
              return 'on-track';
            }
            function statusFace(status) {
              if (status === 'on-track') return '😀';
              if (status === 'off-track') return '☹';
              return '😐';
            }
            const status = rubricStatus(total);
            return {
              status,
              face: statusFace(status),
              publicText: n.publicText || '',
              createdAt: n.createdAt || null,
              authorRole: n.authorRole || null,
            };
          }) : [];
          const syntheticReport = {
            weekLabel: `Week ${value}`,
            status: items.length ? items[items.length - 1].status : 'normal',
            mood: '',
            notes: '',
            items,
          };
          applyReport(syntheticReport);
        } catch (err) {
          console.error('Failed to load eval notes for week:', err);
          applyReport(null);
        }
      });
    }
  }

  // Public notes section removed for student view
  function renderPublicNotes(container) {
    if (!container) return;
    container.innerHTML = '';
  }

  // Journals with replies section removed for student view
  function renderJournalsWithReplies(container) {
    if (!container) return;
    container.innerHTML = '';
  }

  async function loadWeeklyEvaluation() {
    const currentUser = getCurrentUser();
    const email = (currentUser.email || '').toLowerCase();

    const summaryBox = document.getElementById('weeklyEvalSummary');
    const notesBox = document.getElementById('weeklyEvalPublicNotes');
    const journalsBox = document.getElementById('weeklyEvalJournalReplies');

    if (summaryBox) {
      summaryBox.innerHTML = '<p>Loading weekly evaluation…</p>';
    }
    if (notesBox) {
      notesBox.innerHTML = '';
    }
    if (journalsBox) {
      journalsBox.innerHTML = '';
    }

    try {
      // Original weekly evaluation aggregate (may include journals, existing reports)
      const data = await fetchJSON(
        `${API_BASE}/student/weekly-evaluation?email=${encodeURIComponent(email)}`,
      );

      // Fetch evaluation journal notes (rubric scores + public/private) to derive weekly status
      let evalJournalNotes = [];
      try {
        evalJournalNotes = await fetchJSON(
          `${API_BASE}/eval-notes?email=${encodeURIComponent(email)}`,
        );
      } catch {
        evalJournalNotes = [];
      }

      // Derive week-based reports from eval journal notes
      function rubricStatus(total) {
        const t = typeof total === 'number' ? total : Number(total) || 0;
        if (t <= 5) return 'off-track';
        if (t <= 10) return 'normal';
        return 'on-track';
      }
      function statusFace(status) {
        if (status === 'on-track') return '😀';
        if (status === 'off-track') return '☹';
        return '😐';
      }

      // Group notes by week; keep ALL notes per week for multi-grid rendering
      const byWeek = new Map();
      evalJournalNotes.forEach(n => {
        const w = n.week != null ? parseInt(n.week, 10) : null;
        if (!Number.isFinite(w) || w <= 0) return; // only consider valid weeks
        const createdAt = n.createdAt ? new Date(n.createdAt).getTime() : 0;
        const scores = n.scores || {};
        const total = typeof scores.total === 'number' ? scores.total : (Number(scores.total) || 0);
        const status = rubricStatus(total);
        const item = {
          week: w,
          status,
          face: statusFace(status),
          publicText: n.publicText || '',
          total,
          independence: scores.independence,
          technical: scores.technical,
          teamwork: scores.teamwork,
          createdAt,
        };
        const arr = byWeek.get(w) || [];
        arr.push(item);
        byWeek.set(w, arr);
      });

      const evalReportsFromJournal = Array.from(byWeek.entries())
        .map(([w, items]) => ({
          week: w,
          weekLabel: `Week ${w}`,
          status: items[items.length - 1]?.status || 'normal',
          face: items[items.length - 1]?.face || '😐',
          items: items.sort((a,b) => a.createdAt - b.createdAt),
        }))
        .sort((a, b) => a.week - b.week);

      // Merge existing reports (if any) with journal-derived reports (avoid duplicates by week number)
      const existingReports = Array.isArray(data.evalReports) ? data.evalReports : [];
      const existingWeeks = new Set(
        existingReports
          .map(r => {
            // Attempt to parse week number from r.weekLabel like "Week 3"
            const m = (r.weekLabel || '').match(/Week\s*(\d+)/i);
            return m ? parseInt(m[1], 10) : null;
          })
          .filter(w => Number.isFinite(w))
      );
      const mergedReports = [
        ...existingReports,
        ...evalReportsFromJournal.filter(r => !existingWeeks.has(r.week)),
      ];

      // Build a synthetic object for mood/week filter using merged reports
      // Prefer 'member' shape from API; fall back to 'user' or email-only stub
      const memberObj = data.member || data.user || { email, name: email };
      const moodFilterData = {
        member: memberObj,
        evalReports: mergedReports,
        publicNotes: data.publicNotes, // legacy public notes section
        journalsWithReplies: data.journalsWithReplies,
      };

      // Student view: only show the week dropdown + evaluation notes grid
      renderSummary(summaryBox, moodFilterData); // now blank
      renderMoodAndWeekFilter(moodFilterData);
      renderPublicNotes(notesBox, []); // blank
      renderJournalsWithReplies(journalsBox, []); // blank
    } catch (err) {
      console.error('Failed to load weekly evaluation:', err);
      if (summaryBox) {
        summaryBox.innerHTML =
          '<p style="color:#b00020;">Failed to load weekly evaluation.</p>';
      }
      const evalNotesP = selectEl('[data-eval-notes]');
      if (evalNotesP) {
        evalNotesP.textContent =
          'Unable to load evaluation for this member right now.';
      }
    }
  }

function wirePanelOpenClose() {
  const panel = document.querySelector('.evaluation-panel');
  const openBtns = document.querySelectorAll('.evaluation-trigger');
  const closeBtn = document.querySelector('.close-evaluation');

  if (!panel) return;

  openBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      panel.classList.add('active');
      panel.setAttribute('aria-hidden', 'false');
      loadWeeklyEvaluation();
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      panel.classList.remove('active');
      panel.setAttribute('aria-hidden', 'true');
    });
  }

  panel.addEventListener('click', (e) => {
    if (e.target === panel) {
      panel.classList.remove('active');
      panel.setAttribute('aria-hidden', 'true');
    }
  });
}


  document.addEventListener('DOMContentLoaded', () => {
    wirePanelOpenClose();
    // We only load data when the panel is opened, to avoid unnecessary calls.
  });
})();
