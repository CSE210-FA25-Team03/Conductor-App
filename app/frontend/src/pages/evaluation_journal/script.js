// frontend/src/pages/evaluation_journal/script.js

/* --------------------------------------------------------------------------
   BASIC CONFIG & HELPERS
--------------------------------------------------------------------------- */

const API_BASE = '/api';

// Ensure evaluation journal stylesheet is loaded
(function ensureEvalJournalStyles() {
  const href = '/src/pages/evaluation_journal/style.css';
  const already = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some((l) => (l.getAttribute('href') || '').includes('evaluation_journal/style.css'));
  if (!already) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
})();

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  return res.json();
}

function getCurrentUser() {
  // Unified currentUser if present
  try {
    const stored = JSON.parse(localStorage.getItem('currentUser'));
    if (stored && stored.email) return stored;
  } catch {
    /* ignore */
  }

  // Fallback to legacy keys
  const email = localStorage.getItem('email') || 'professor@school.edu';
  const role = localStorage.getItem('role') || 'professor';

  return {
    email,
    role,
    classId: 'CSE210',
  };
}

const currentUser = getCurrentUser();
const staffEmail = (currentUser.email || '').toLowerCase();

/**
 * Extract an email from the "To" field, allowing formats like:
 *   "student@school.edu"
 *   "@student@school.edu"
 */
function extractEmailFromTo(value) {
  let s = (value || '').trim();
  if (!s) return null;
  if (s.startsWith('@')) s = s.slice(1).trim();
  // Support formats like "Name (email@school.edu)"
  const matchParen = s.match(/\(([^)]+@[^)]+)\)/);
  if (matchParen && matchParen[1]) return matchParen[1].toLowerCase();
  if (!s.includes('@')) return null;
  return s.toLowerCase();
}

/* --------------------------------------------------------------------------
   UI ELEMENTS (Eval Notes UI)
--------------------------------------------------------------------------- */

const btnDefault = document.getElementById('modeDefault');
const btnRubric = document.getElementById('modeRubric');
const rubricPanel = document.getElementById('rubricPanel');
const emojis = document.querySelectorAll('.emoji-icon');
const scoreInputs = document.querySelectorAll('.score-input');
const fill = document.getElementById('sentimentFill');
const totalText = document.getElementById('scoreTotal');
const addBtn = document.getElementById('addEvalBtn');
const cardsBox = document.getElementById('evalCardsBox');
const cardsHeader = document.getElementById('cardsHeader');
const toInput = document.getElementById('toInput');
const privateInput = document.getElementById('privateInput');
const publicInput = document.getElementById('publicInput');
const dateDisplay = document.getElementById('dateDisplay');
const emptyMessage = document.getElementById('emptyMessage');
let weekSelect = document.getElementById('week-select');
let peopleList = [];
let typeaheadMenu;
let teamMemberEmails = null; // when role is team_lead, restrict to these emails

// Only suggest/select students and team leads in the To: field
const allowedRoles = new Set(['student', 'team_lead']);

async function ensureMembersLoaded() {
  if (peopleList && peopleList.length) return peopleList;
  try {
    const res = await fetchJSON(`${API_BASE}/members`);
    if (Array.isArray(res)) {
      let base = res.filter((p) => allowedRoles.has((p.role || '').toLowerCase()));
      // If current user is team_lead, restrict to team members only
      try {
        const role = (currentUser.role || localStorage.getItem('role') || '').toLowerCase();
        const email = (currentUser.email || localStorage.getItem('email') || '').toLowerCase();
        if (role === 'team_lead' && email) {
          // Attempt to load team member emails via my-teams
          const teams = await fetchJSON(`${API_BASE}/my-teams?email=${encodeURIComponent(email)}`);
          const emails = new Set();
          if (Array.isArray(teams)) {
            teams.forEach((t) => {
              // Prefer explicit members array if present
              if (Array.isArray(t.members)) {
                t.members.forEach((m) => {
                  const e = (m.email || m.userEmail || m).toLowerCase?.() || String(m).toLowerCase();
                  if (e) emails.add(e);
                });
              }
              // Fallback: leader and repo participants (if available)
              if (t.leaderEmail) emails.add(String(t.leaderEmail).toLowerCase());
            });
          }
          if (emails.size) {
            teamMemberEmails = emails;
            base = base.filter((p) => emails.has((p.email || '').toLowerCase()));
          }
        }
      } catch { /* ignore team scoping errors */ }
      peopleList = base;
    } else {
      peopleList = [];
    }
  } catch {
    peopleList = [];
  }
  return peopleList;
}

function findMemberNameByEmail(email) {
  const e = (email || '').toLowerCase();
  if (!e || !peopleList || !peopleList.length) return null;
  const m = peopleList.find((p) => (p.email || '').toLowerCase() === e);
  return m ? (m.name || null) : null;
}

const workJournalBox = document.getElementById('workJournalBox');
const wjSections = document.getElementById('wjSections');
// Current filter for Recent Work Journals (email)
let journalsFilterEmail = null;
let journalsTypeaheadMenu = null;

/* Modal Elements (Eval notes "More" modal) */
const modal = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');
const modalTo = document.getElementById('modalTo');
const modalTime = document.getElementById('modalTime');
const modalPrivate = document.getElementById('modalPrivate');
const modalPublic = document.getElementById('modalPublic');

let mode = 'rubric';
const currentTarget = {
  raw: null,
  email: null,
};

/* --------------------------------------------------------------------------
   DATE DISPLAY
--------------------------------------------------------------------------- */
function updateDate() {
  if (!dateDisplay) return;
  // Hide time/date per new UX
  dateDisplay.style.display = 'none';
}
updateDate();

// Initialize Week select options (Week 1..10)
(function ensureWeekSelect() {
  let sel = weekSelect;
  // Create Week select dynamically if missing
  if (!sel) {
    // Build a Week block with label and dropdown stacked
    const block = document.createElement('div');
    block.id = 'week-block';
    block.style.display = 'flex';
    block.style.flexDirection = 'column';
    block.style.marginTop = '8px';

    const label = document.createElement('div');
    label.textContent = 'Week:';
    label.style.fontWeight = 'normal';
    label.style.marginBottom = '4px';
    label.style.fontSize = '0.95rem';

    const created = document.createElement('select');
    created.id = 'week-select';
    created.style.padding = '6px 8px';
    created.style.border = '1px solid #ddd';
    created.style.borderRadius = '6px';

    block.appendChild(label);
    block.appendChild(created);

    // Try to insert under To: input
    const anchor = document.getElementById('toInput');
    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(block, anchor.nextSibling);
    } else {
      // Fallback to body
      document.body.appendChild(block);
    }
    sel = created;
  }
  if (sel.options.length > 0) { weekSelect = sel; return; }
  for (let i = 1; i <= 10; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    sel.appendChild(opt);
  }
  // ensure global reference points to the created/select element
  weekSelect = sel;
  // Set a sensible default (Week 1)
  if (sel.options.length > 0) {
    sel.selectedIndex = 0;
  }
})();

/* --------------------------------------------------------------------------
   MODE TOGGLE (Default vs Rubric) — client-side only
--------------------------------------------------------------------------- */
if (btnDefault) {
  // Hide Default toggle per simplified rubric-only UI
  btnDefault.style.display = 'none';
}

if (btnRubric) {
  // Hide Rubric toggle button (always on)
  btnRubric.style.display = 'none';
  if (rubricPanel) rubricPanel.style.display = 'block';
  emojis.forEach((e) => (e.style.display = 'none'));
}

// Safety: ensure rubric panel is visible on load even if buttons are missing
if (rubricPanel) {
  rubricPanel.style.display = 'block';
}

/* Emoji click (visual sentiment) */
// Remove emoji interactions

/* Rubric score update */
function updateScore() {
  if (mode !== 'rubric') return;

  let total = 0;
  scoreInputs.forEach((i) => {
    i.value = i.value.replace(/\D/g, "");
    i.value = i.value.replace(/[6789]/g, "");
    i.value = i.value.slice(0, 1);

    total += Number(i.value) || 0;
  });
  if (total > 15) total = 15;

  if (totalText) totalText.textContent = total;
  if (fill) fill.style.width = `${(total / 15) * 100}%`;

  // No emoji state in simplified UI
  // Update status label using rubricStatus(total)
  const statusEl = document.getElementById('sentimentStatus');
  if (statusEl) {
    const status = rubricStatus(total);
    const color = status === 'off-track' ? '#d32f2f' : status === 'normal' ? '#f9a825' : '#2e7d32';
    statusEl.textContent = `Status: ${status}`;
    statusEl.style.color = color;
  }
}
function rubricStatus(total) {
  const t = typeof total === 'number' ? total : Number(total) || 0;
  if (t <= 5) return 'off-track';
  if (t <= 10) return 'normal';
  return 'on-track';
}
scoreInputs.forEach((i) => {
  i.oninput = updateScore;
});

// Initialize status display at load (with total 0)
updateScore();

/* --------------------------------------------------------------------------
   EVAL NOTES: DB-backed via /api/eval-notes
--------------------------------------------------------------------------- */

function checkEmptyState() {
  if (!cardsBox || !emptyMessage) return;
  const hasCard = !!cardsBox.querySelector('.eval-card');
  emptyMessage.style.display = hasCard ? 'none' : 'flex';
}

/**
 * Render eval notes for a target email.
 */
function renderEvalNotes(notes, targetEmail) {
  if (!cardsBox || !cardsHeader || !emptyMessage) return;

  cardsBox.innerHTML = '';

  if (!Array.isArray(notes) || !notes.length) {
    // Use Name (email) when possible
    const targetName = findMemberNameByEmail(targetEmail);
    const displayTarget = targetEmail
      ? (targetName ? `${targetName} (${targetEmail})` : targetEmail)
      : null;
    cardsHeader.textContent = displayTarget ? `Eval Notes for ${displayTarget}` : 'All Eval Cards (Group & Individual)';
    emptyMessage.style.display = 'flex';
    return;
  }

  emptyMessage.style.display = 'none';
  {
    const targetName = findMemberNameByEmail(targetEmail);
    const displayTarget = targetEmail
      ? (targetName ? `${targetName} (${targetEmail})` : targetEmail)
      : null;
    cardsHeader.textContent = displayTarget ? `Eval Notes for ${displayTarget}` : 'All Eval Cards (Group & Individual)';
  }

  const sorted = notes
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );

  sorted.forEach((n) => {
    const when = n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Unknown time';
    const priv = n.privateText || n.body || 'None';
    const pub = n.publicText || 'None';
    // const author = n.authorName || n.authorEmail || 'Staff';
    const week = n.week ?? n.weekNumber ?? null;
    // Robustly derive scores from possible backend shapes
    const rawScores = n.scores || n.score || {};
    const scores = {
      independence: Number(rawScores.independence ?? n.independence ?? 0) || 0,
      technical: Number(rawScores.technical ?? n.technical ?? 0) || 0,
      teamwork: Number(rawScores.teamwork ?? n.teamwork ?? 0) || 0,
      total: Number(rawScores.total ?? n.total ?? ((Number(rawScores.independence ?? n.independence ?? 0) || 0) + (Number(rawScores.technical ?? n.technical ?? 0) || 0) + (Number(rawScores.teamwork ?? n.teamwork ?? 0) || 0))) || 0,
    };
    const sentimentStatus = rubricStatus(scores.total);

    const tgtEmail = (n.targetEmail || targetEmail || '').toLowerCase();
    const tgtName = findMemberNameByEmail(tgtEmail);
    const toLabel = tgtEmail ? (tgtName ? `${tgtName} (${tgtEmail})` : tgtEmail) : 'Unknown';

    const card = document.createElement('div');
    card.className = 'eval-card';
    card.dataset.to = toLabel;
    card.dataset.time = when;
    card.dataset.private = priv;
    card.dataset.public = pub;
    card.dataset.week = week !== null ? String(week) : '';
    card.dataset.scores = encodeURIComponent(JSON.stringify(scores));
    card.dataset.sentiment = sentimentStatus;

    card.innerHTML = `
      <div class="wj-grid">
        <div class="wj-cell">To: ${toLabel}</div>
        <div class="wj-cell" style="color:#555;">Week: ${week ?? '—'}</div>
        <div class="wj-cell" style="color:#666;">${when}</div>
        <div class="wj-cell" style="text-align:right;"><button class="wj-view-eval">View Detail</button></div>
      </div>
    `;

    cardsBox.appendChild(card);
  });

  checkEmptyState();
}

/**
 * Load eval notes for the current "To" email.
 */
async function loadEvalNotesForCurrentTarget() {
  const email = currentTarget.email;
  if (!email) {
    if (cardsHeader) {
      cardsHeader.textContent = 'All Eval Cards (Group & Individual)';
    }
    if (cardsBox) cardsBox.innerHTML = '';
    checkEmptyState();
    return;
  }

  try {
    // Ensure members are loaded so we can display Name (email)
    await ensureMembersLoaded();
    const notes = await fetchJSON(
      `${API_BASE}/eval-notes?email=${encodeURIComponent(email)}`,
    );
    renderEvalNotes(notes, email);
  } catch (err) {
    console.error('Failed to load eval notes:', err);
    if (cardsBox) {
      cardsBox.innerHTML =
        '<p style="font-size:0.9rem;color:#b00020;">Failed to load eval notes.</p>';
    }
    if (emptyMessage) emptyMessage.style.display = 'none';
  }
}

/* "To" input events: set target + load notes + load journals */
if (toInput) {
  toInput.addEventListener('blur', () => {
    const raw = toInput.value.trim();
    currentTarget.raw = raw;
    currentTarget.email = extractEmailFromTo(raw);
    loadEvalNotesForCurrentTarget();
  });

  // Lightweight typeahead suggestions
  toInput.addEventListener('input', async () => {
    const q = toInput.value.trim().toLowerCase();
    if (!q) {
      if (typeaheadMenu) typeaheadMenu.style.display = 'none';
      return;
    }
    await ensureMembersLoaded();
    let base = peopleList;
    // Double-ensure team scoping if emails known
    if (teamMemberEmails && teamMemberEmails.size) {
      base = base.filter((p) => teamMemberEmails.has((p.email || '').toLowerCase()));
    }
    const matches = base
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 6);

    if (!typeaheadMenu) {
      typeaheadMenu = document.createElement('div');
      typeaheadMenu.style.position = 'absolute';
      typeaheadMenu.style.background = '#fff';
      typeaheadMenu.style.border = '1px solid #ddd';
      typeaheadMenu.style.borderRadius = '6px';
      typeaheadMenu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
      typeaheadMenu.style.zIndex = '1000';
      typeaheadMenu.style.fontSize = '0.9rem';
      document.body.appendChild(typeaheadMenu);
    }

    const rect = toInput.getBoundingClientRect();
    typeaheadMenu.style.left = `${rect.left + window.scrollX}px`;
    typeaheadMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    typeaheadMenu.style.minWidth = `${rect.width}px`;

    if (!matches.length) {
      typeaheadMenu.style.display = 'none';
      return;
    }

    typeaheadMenu.innerHTML = '';
    matches.forEach((p) => {
      const item = document.createElement('div');
      item.style.padding = '6px 10px';
      item.style.cursor = 'pointer';
      const name = p.name || p.full_name || '';
      const email = p.email || p.user_email || '';
      item.textContent = `${name || email} (${email})`;
      item.addEventListener('mouseenter', () => {
        item.style.background = '#f5f5f5';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = '#fff';
      });
      item.addEventListener('click', () => {
        toInput.value = `@${name ? `${name} (${email})` : email}`;
        currentTarget.raw = toInput.value.trim();
        currentTarget.email = email.toLowerCase();
        typeaheadMenu.style.display = 'none';
        loadEvalNotesForCurrentTarget();
      });
      typeaheadMenu.appendChild(item);
    });
    typeaheadMenu.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!typeaheadMenu) return;
    if (e.target === toInput || typeaheadMenu.contains(e.target)) return;
    typeaheadMenu.style.display = 'none';
  });
}

/* Add Eval Note */
if (addBtn) {
  addBtn.onclick = async () => {
    if (!toInput) return;

    const raw = toInput.value.trim();
    currentTarget.raw = raw;
    currentTarget.email = extractEmailFromTo(raw);

    if (!currentTarget.email) {
      alert(
        'Please enter the student email in the "To:" field, e.g. student@school.edu',
      );
      return;
    }

    const priv = (privateInput?.value || '').trim();
    const pub = (publicInput?.value || '').trim();
    if (!priv && !pub) {
      alert('Please enter some text in Private and/or Public notes.');
      return;
    }

    let independence = null;
    let technical = null;
    let teamwork = null;
    let total = null;

    if (mode === 'rubric') {
      // Read numeric values robustly; treat empty as 0
      const vals = Array.from(scoreInputs).map((i) => {
        const v = typeof i.value === 'string' ? i.value.trim() : i.value;
        const num = Number(v);
        return Number.isFinite(num) ? num : 0;
      });
      independence = vals[0] ?? 0;
      technical = vals[1] ?? 0;
      teamwork = vals[2] ?? 0;
      // Clamp each to [0,5] then compute total
      independence = Math.max(0, Math.min(5, independence));
      technical = Math.max(0, Math.min(5, technical));
      teamwork = Math.max(0, Math.min(5, teamwork));
      total = independence + technical + teamwork;
    }

    try {
      await fetchJSON(`${API_BASE}/eval-notes`, {
        method: 'POST',
        body: JSON.stringify({
          targetEmail: currentTarget.email,
          privateText: priv,
          publicText: pub,
          mode,
          scores: {
            independence,
            technical,
            teamwork,
            total,
          },
          email: staffEmail,
          // Read week from DOM to avoid stale reference
          week: (function() {
            const sel = document.getElementById('week-select') || weekSelect;
            return sel ? (parseInt(sel.value || '0', 10) || null) : null;
          })(),
        }),
      });

      // clear inputs
      if (privateInput) privateInput.value = '';
      if (publicInput) publicInput.value = '';
      scoreInputs.forEach((i) => (i.value = ''));
      updateScore();
      updateDate();

      // reload notes
      await loadEvalNotesForCurrentTarget();
    } catch (err) {
      console.error('Failed to create eval note:', err);
      alert('Failed to save eval note. Check console for details.');
    }
  };
}

/* Eval notes modal */
if (cardsBox && modal) {
  cardsBox.onclick = (e) => {
    const btn = e.target.closest('.wj-view-eval');
    if (!btn) return;

    const card = btn.closest('.eval-card');
    if (!card) return;

    if (modalTo) modalTo.textContent = `To: ${card.dataset.to}`;
    // Replace Time display with Week per requested save detail
    if (modalTime) modalTime.textContent = `Week: ${card.dataset.week || '—'}`;
    if (modalPrivate) modalPrivate.textContent = `Private: ${card.dataset.private}`;
    if (modalPublic) modalPublic.textContent = `Public: ${card.dataset.public}`;

    // Show sentiment score and rubric (if available)
    const scoresStr = card.dataset.scores || '';
    let scores = {};
    try { scores = JSON.parse(decodeURIComponent(scoresStr)); } catch { scores = {}; }
    const sentiment = card.dataset.sentiment || '';
    const total = typeof scores.total === 'number' ? scores.total : (Number(scores.total) || 0);

    // Append extra details section once per open
    let extra = modal.querySelector('.eval-extra');
    if (!extra) {
      extra = document.createElement('div');
      extra.className = 'eval-extra';
      extra.style.marginTop = '10px';
      extra.style.fontSize = '0.9rem';
      modal.querySelector('.modal-content')?.appendChild(extra);
    }
    extra.innerHTML = `
      <div style="margin:4px 0;">Sentiment Score: <strong>${sentiment || '—'}</strong></div>
      <div style="margin:4px 0;">Rubric:
        <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:6px;">
          <span>Independence: <strong>${scores.independence ?? 0}</strong></span>
          <span>Technical: <strong>${scores.technical ?? 0}</strong></span>
          <span>Teamwork: <strong>${scores.teamwork ?? 0}</strong></span>
          <span>Total: <strong>${total}</strong></span>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  };
}

if (closeModal && modal) {
  closeModal.onclick = () => {
    modal.style.display = 'none';
  };
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };
}

/* --------------------------------------------------------------------------
   WORK JOURNALS + REPLIES
--------------------------------------------------------------------------- */

/**
 * Render work journals for the "To:" value.
 * Uses GET /api/work-journals?forName=<rawToValue>
 */
async function renderWorkJournalCards() {
  const container = wjSections || workJournalBox;
  if (!container) return;

  // Header with title and filter search bar
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'wj-sec-header';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '12px';
  header.style.marginBottom = '6px';

  const titleEl = document.createElement('div');
  // Dynamic title: show filter target if applied
  let titleText = '';
  if (journalsFilterEmail) {
    try {
      await ensureMembersLoaded();
      const name = findMemberNameByEmail(journalsFilterEmail);
      const label = name ? `${name} (${journalsFilterEmail})` : journalsFilterEmail;
      titleText = `Filter by: ${label}`;
    } catch { /* ignore, keep default */ }
  }
  titleEl.textContent = titleText;
  titleEl.style.fontSize = '1rem';
  titleEl.style.fontWeight = '600';

  const filterWrap = document.createElement('div');
  filterWrap.style.display = 'flex';
  filterWrap.style.alignItems = 'center';
  filterWrap.style.gap = '8px';

  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.placeholder = 'Filter by Name or Email';
  filterInput.style.padding = '6px 8px';
  filterInput.style.border = '1px solid #ddd';
  filterInput.style.borderRadius = '6px';
  filterInput.style.minWidth = '240px';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.padding = '6px 10px';
  clearBtn.style.border = '1px solid #ddd';
  clearBtn.style.borderRadius = '6px';
  clearBtn.style.background = '#f7f7f7';
  clearBtn.addEventListener('click', () => {
    journalsFilterEmail = null;
    filterInput.value = '';
    renderWorkJournalCards();
  });

  filterWrap.appendChild(filterInput);
  filterWrap.appendChild(clearBtn);
  header.appendChild(titleEl);
  header.appendChild(filterWrap);
  container.appendChild(header);

  const loading = document.createElement('p');
  loading.style.fontSize = '0.9rem';
  loading.style.color = '#777';
  loading.textContent = 'Loading work journals...';
  container.appendChild(loading);

  try {
    const payload = await fetchJSON(
      `${API_BASE}/work-journals/review?email=${encodeURIComponent(staffEmail)}`
    );

    let newer = Array.isArray(payload.newer) ? payload.newer : [];
    let read = Array.isArray(payload.read) ? payload.read : [];

    // Team Leads should only see Public journals
    try {
      const viewerRole = (currentUser.role || localStorage.getItem('role') || '').toLowerCase();
      if (viewerRole === 'team_lead') {
        const viewerEmail = (currentUser.email || localStorage.getItem('email') || '').toLowerCase();
        const onlyPublic = (j) => ((j.visibility || '').toLowerCase() === 'public');
        const notSelf = (j) => (j.userEmail || '').toLowerCase() !== viewerEmail;
        newer = newer.filter((j) => onlyPublic(j) && notSelf(j));
        read = read.filter((j) => onlyPublic(j) && notSelf(j));
      }
    } catch { /* ignore */ }

    // Apply filter by selected email
    if (journalsFilterEmail) {
      const f = journalsFilterEmail.toLowerCase();
      newer = newer.filter(j => (j.userEmail || '').toLowerCase() === f);
      read = read.filter(j => (j.userEmail || '').toLowerCase() === f);
    }

    function cardHtml(j, isNew) {
      const createdAt = j.createdAt ? new Date(j.createdAt) : null;
      const when = createdAt ? createdAt.toLocaleString() : 'Unknown time';
      const authorName = j.userName || 'Unknown';
      const mention = j.mentionYou ? '<span class="tag-pill tag-mention">Mention You</span>' : '';
      return `
        <div class="wj-grid">
          <div class="wj-cell">${authorName} ${mention}</div>
          <div class="wj-cell" style="color:#555;">${j.userEmail || ''}</div>
          <div class="wj-cell" style="color:#666;">${when}</div>
          <div class="wj-cell" style="text-align:right;">
            <button class="wj-view-btn" data-journal-id="${j.id}">View Details</button>
            ${isNew ? '<button class="wj-archive-btn" data-journal-id="' + j.id + '" style="margin-left:6px;">Archive</button>' : ''}
          </div>
        </div>
        <div class="eval-card-section journal-replies" data-journal-id="${j.id}" style="display:none;">
          <div class="journal-detail"></div>
        </div>`;
    }

    function renderSection(title, items, initiallyOpen) {
      const sec = document.createElement('div');
      const hdr = document.createElement('div');
      const body = document.createElement('div');
      hdr.className = 'wj-sec-header';
      const count = items.length;
      const arrow = initiallyOpen ? '▾' : '▸';
      hdr.innerHTML = `<button class="wj-dd-toggle" aria-expanded="${initiallyOpen}" style="display:flex; align-items:center; gap:8px; background:none; border:none; padding:4px 0; cursor:pointer; font-size:1rem;">
        <span class="wj-dd-arrow" style="font-weight:bold;">${arrow}</span>
        <span>${title}</span>
        <span style="font-size:0.85rem; background:#333; color:#fff; border-radius:10px; padding:2px 8px;">${count}</span>
      </button>`;
      body.className = 'wj-sec-body';
      body.style.display = initiallyOpen ? '' : 'none';
      const toggleBtn = hdr.querySelector('.wj-dd-toggle');
      const arrowEl = hdr.querySelector('.wj-dd-arrow');
      toggleBtn.addEventListener('click', () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        toggleBtn.setAttribute('aria-expanded', String(!open));
        arrowEl.textContent = open ? '▸' : '▾';
      });

      if (!items.length) {
        body.innerHTML = '<p style="font-size:0.9rem;color:#777;">None</p>';
      } else {
        const isNew = title.toLowerCase() === 'new';
        items.forEach(j => {
          const card = document.createElement('div');
          card.className = 'eval-card journal-card';
          card.innerHTML = cardHtml(j, isNew);
          try {
            card.dataset.journal = encodeURIComponent(JSON.stringify({
              id: j.id,
              content: j.content,
              moodText: j.moodText,
              sentimentSelf: j.sentimentSelf,
              visibility: j.visibility,
              createdAt: j.createdAt,
              userName: j.userName,
              userEmail: j.userEmail,
              reachOutTo: j.reachOutTo,
              mentionYou: j.mentionYou
            }));
          } catch { /* ignore */ }
          body.appendChild(card);
        });
      }

      sec.appendChild(hdr);
      sec.appendChild(body);
      return sec;
    }

    // Replace loading with sections, keep header
    container.removeChild(loading);
    container.appendChild(renderSection('New', newer, true));
    container.appendChild(renderSection('Read', read, false));

    // Setup typeahead for filter input (students + team leads)
    filterInput.addEventListener('input', async () => {
      const q = filterInput.value.trim().toLowerCase();
      if (!q) {
        if (journalsTypeaheadMenu) journalsTypeaheadMenu.style.display = 'none';
        return;
      }
      await ensureMembersLoaded();
      let base = peopleList;
      if (teamMemberEmails && teamMemberEmails.size) {
        base = base.filter((p) => teamMemberEmails.has((p.email || '').toLowerCase()));
      }
      const matches = base
        .filter((p) => {
          const name = (p.name || '').toLowerCase();
          const email = (p.email || '').toLowerCase();
          return name.includes(q) || email.includes(q);
        })
        .slice(0, 6);

      if (!journalsTypeaheadMenu) {
        journalsTypeaheadMenu = document.createElement('div');
        journalsTypeaheadMenu.style.position = 'absolute';
        journalsTypeaheadMenu.style.background = '#fff';
        journalsTypeaheadMenu.style.border = '1px solid #ddd';
        journalsTypeaheadMenu.style.borderRadius = '6px';
        journalsTypeaheadMenu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        journalsTypeaheadMenu.style.zIndex = '1000';
        journalsTypeaheadMenu.style.fontSize = '0.9rem';
        document.body.appendChild(journalsTypeaheadMenu);
      }

      const rect = filterInput.getBoundingClientRect();
      journalsTypeaheadMenu.style.left = `${rect.left + window.scrollX}px`;
      journalsTypeaheadMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
      journalsTypeaheadMenu.style.minWidth = `${rect.width}px`;

      if (!matches.length) {
        journalsTypeaheadMenu.style.display = 'none';
        return;
      }

      journalsTypeaheadMenu.innerHTML = '';
      matches.forEach((p) => {
        const item = document.createElement('div');
        item.style.padding = '6px 10px';
        item.style.cursor = 'pointer';
        const name = p.name || p.full_name || '';
        const email = p.email || p.user_email || '';
        item.textContent = `${name || email} (${email})`;
        item.addEventListener('mouseenter', () => {
          item.style.background = '#f5f5f5';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = '#fff';
        });
        item.addEventListener('click', () => {
          filterInput.value = `${name ? `${name} (${email})` : email}`;
          journalsFilterEmail = email.toLowerCase();
          journalsTypeaheadMenu.style.display = 'none';
          renderWorkJournalCards();
        });
        journalsTypeaheadMenu.appendChild(item);
      });
      journalsTypeaheadMenu.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if (!journalsTypeaheadMenu) return;
      if (e.target === filterInput || journalsTypeaheadMenu.contains(e.target)) return;
      journalsTypeaheadMenu.style.display = 'none';
    });
  } catch (err) {
    console.error('No work journals yet.', err);
    (wjSections || workJournalBox).innerHTML =
      '<p style="font-size:0.9rem;color:#b00020;">No work journals yet.</p>';
  }
}

/**
 * Handle reply submit (event delegation).
 */
if (wjSections || workJournalBox) {
  const containerEl = wjSections || workJournalBox;
  containerEl.addEventListener('click', async (e) => {
    // Open details only (do not mark as read here)
    const viewBtn = e.target.closest('.wj-view-btn');
    if (viewBtn) {
      // const journalId = viewBtn.getAttribute('data-journal-id');
      const repliesWrap = viewBtn.closest('.journal-card')?.querySelector('.journal-replies');
      if (repliesWrap) {
        const detail = repliesWrap.querySelector('.journal-detail');
        // Populate detail block with richer fields if available
        const parentCard = viewBtn.closest('.journal-card');
        if (detail && parentCard) {
          // Build modal-like detail
            detail.innerHTML = `
            <div class="wj-detail-modal" style="position:relative; border:1px solid #ddd; border-radius:8px; padding:10px; background:#fff;">
              <button class="wj-detail-close" title="Close" style="position:absolute; top:8px; right:8px; border:none; background:#eee; border-radius:50%; width:24px; height:24px; cursor:pointer;">✖</button>
            <div style="font-weight:600; margin-bottom:6px;">Journal Details</div>
            <div style="margin:4px 0;">Name: <span class="wj-det-name"></span></div>
            <div style="margin:4px 0;">Email: <span class="wj-det-email"></span></div>
            <div style="margin:4px 0;">Time: <span class="wj-det-time"></span></div>
            <div style="margin:6px 0;">Student Note:</div>
            <div class="wj-det-student" style="white-space:pre-wrap; font-size:0.9rem; margin-bottom:6px;"></div>
            <div style="margin:6px 0;">Mood Note:</div>
            <div class="wj-det-mood" style="white-space:pre-wrap; font-size:0.85rem; margin-bottom:6px; color:#444;"></div>
            <div class="wj-det-reach-wrap" style="display:none; margin:6px 0;">
              <div style="margin:0 0 4px;">Reach out Message:</div>
              <div class="wj-det-reach" style="white-space:pre-wrap; font-size:0.85rem; color:#444;"></div>
            </div>
            <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:4px; font-size:0.85rem;">
              <span>Sentiment: <span class="wj-det-sent" style="font-weight:600;"></span></span>
              <span>Visibility: <span class="wj-det-vis" style="font-weight:600;"></span></span>
            </div>
            </div>`;
          const nameCell = parentCard.querySelector('.wj-grid .wj-cell')?.innerText || '';
          const emailCell = parentCard.querySelector('.wj-grid .wj-cell:nth-child(2)')?.innerText || '';
          const timeCell = parentCard.querySelector('.wj-grid .wj-cell:nth-child(3)')?.innerText || '';
          let journalData = {};
          try {
            const raw = parentCard.dataset.journal;
            if (raw) journalData = JSON.parse(decodeURIComponent(raw));
          } catch { /* ignore */ }
          // Parse content into student note & mood note
          const fullContent = journalData.content || '';
          let studentNote = fullContent;
          let moodNote = '';
          // Split on Notes marker if present
          const notesIdx = fullContent.indexOf('\n\nNotes:\n');
          if (notesIdx !== -1) {
            studentNote = fullContent.slice(0, notesIdx).trim();
            const afterNotes = fullContent.slice(notesIdx + '\n\nNotes:\n'.length);
            // Remove reach-out and repo sections from moodNote
            moodNote = afterNotes.split(/\n\nReach-out message:/)[0].split(/\n\nRepo:/)[0].trim();
          }
          // Sentiment mapping
          function mapSentiment(num, moodText) {
            if (moodText && /great|😀/i.test(moodText)) return 'Great';
            if (moodText && /good|🙂/i.test(moodText)) return 'Good';
            if (moodText && /okay|😐/i.test(moodText)) return 'Okay';
            if (moodText && /stressed|😟|overwhelmed|😫|bad|terrible|😢|😭/i.test(moodText)) return 'Stressed';
            if (num === 2) return 'Good';
            if (num === 0) return 'Stressed';
            return 'Okay';
          }
          const sentimentLabel = mapSentiment(journalData.sentimentSelf, journalData.moodText);
          const visibilityLabel = (journalData.visibility || '').toLowerCase() === 'public' ? 'Public' : 'Private';
          // Extract reach-out message if present
          let reachMessage = '';
          const reachMarker = '\n\nReach-out message:\n';
          const reachIdx = fullContent.indexOf(reachMarker);
          if (reachIdx !== -1) {
            const afterReach = fullContent.slice(reachIdx + reachMarker.length);
            reachMessage = afterReach.split(/\n\nRepo:/)[0].trim();
          }
          // Populate detail fields
          detail.querySelector('.wj-det-name').textContent = journalData.userName || nameCell;
          detail.querySelector('.wj-det-email').textContent = journalData.userEmail || emailCell;
          detail.querySelector('.wj-det-time').textContent = timeCell;
          detail.querySelector('.wj-det-student').textContent = studentNote || '—';
          detail.querySelector('.wj-det-mood').textContent = moodNote || '—';
          detail.querySelector('.wj-det-sent').textContent = sentimentLabel || '—';
          detail.querySelector('.wj-det-vis').textContent = visibilityLabel;
          // Reach out message only if journal mentions viewer
          const wrapReach = detail.querySelector('.wj-det-reach-wrap');
          if (wrapReach) {
            if (journalData.mentionYou) {
              wrapReach.style.display = 'block';
              const reachEl = wrapReach.querySelector('.wj-det-reach');
              if (reachEl) reachEl.textContent = reachMessage || '—';
            }
          }
            const closeBtn = detail.querySelector('.wj-detail-close');
            closeBtn.addEventListener('click', () => {
              repliesWrap.style.display = 'none';
            });
        }
          // Open detail and keep open until user closes via ✖
          repliesWrap.style.display = '';
      }
      return;
    }

    // Archive: mark as read and refresh (only appears in New section)
    const archiveBtn = e.target.closest('.wj-archive-btn');
    if (archiveBtn) {
      const journalId = archiveBtn.getAttribute('data-journal-id');
      try {
        await fetchJSON(`${API_BASE}/work-journals/${encodeURIComponent(journalId)}/read`, {
          method: 'POST',
          body: JSON.stringify({ email: staffEmail }),
        });
        // Reload sections to move item from New -> Read
        renderWorkJournalCards();
      } catch (err) {
        console.error('Failed to archive journal:', err);
      }
      return;
    }
  });
}

/* --------------------------------------------------------------------------
   INITIAL STATE
--------------------------------------------------------------------------- */

renderWorkJournalCards();
checkEmptyState();
