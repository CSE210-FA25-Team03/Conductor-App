/* === Buttons & UI Elements === */
const btnDefault = document.getElementById("modeDefault");
const btnRubric = document.getElementById("modeRubric");
const rubricPanel = document.getElementById("rubricPanel");
const emojis = document.querySelectorAll(".emoji-icon");
const scoreInputs = document.querySelectorAll(".score-input");
const fill = document.getElementById("sentimentFill");
const totalText = document.getElementById("scoreTotal");
const addBtn = document.getElementById("addEvalBtn");
const cardsBox = document.getElementById("evalCardsBox");
const cardsHeader = document.getElementById("cardsHeader");
const toInput = document.getElementById("toInput");
const privateInput = document.getElementById("privateInput");
const publicInput = document.getElementById("publicInput");
const dateDisplay = document.getElementById("dateDisplay");
const emptyMessage = document.getElementById("emptyMessage");

/* Journal users storage */
const journalUsers = new Set();

/* Modal Elements */
const modal = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalTo = document.getElementById("modalTo");
const modalTime = document.getElementById("modalTime");
const modalPrivate = document.getElementById("modalPrivate");
const modalPublic = document.getElementById("modalPublic");

let mode = "default";

/* === Date Display === */
function updateDate() {
  if (!dateDisplay) return;
  dateDisplay.textContent = new Date().toLocaleString();
}
updateDate();

/* === Mode Toggle === */
btnDefault.onclick = () => {
  mode = "default";
  btnDefault.classList.add("active");
  btnRubric.classList.remove("active");
  rubricPanel.style.display = "none";
  emojis.forEach(e => e.classList.remove("active"));
};

btnRubric.onclick = () => {
  mode = "rubric";
  btnRubric.classList.add("active");
  btnDefault.classList.remove("active");
  rubricPanel.style.display = "block";
  emojis.forEach(e => e.classList.remove("active"));
};

/* === Emoji Click === */
emojis.forEach(e => {
  e.onclick = () => {
    if (mode !== "default") return;
    emojis.forEach(x => x.classList.remove("active"));
    e.classList.add("active");
  };
});

/* === Rubric Score Update === */
function updateScore() {
  if (mode !== "rubric") return;

  let total = 0;
  scoreInputs.forEach(i => total += Number(i.value) || 0);
  if (total > 15) total = 15;

  totalText.textContent = total;
  fill.style.width = (total / 15) * 100 + "%";

  emojis.forEach(e => e.classList.remove("active"));
  if (total >= 11) emojis[0].classList.add("active");
  else if (total >= 6) emojis[1].classList.add("active");
  else emojis[2].classList.add("active");
}
scoreInputs.forEach(i => (i.oninput = updateScore));

/* === Empty State Check === */
function checkEmptyState() {
  const cards = cardsBox.querySelectorAll(".eval-card");
  emptyMessage.style.display = cards.length === 0 ? "flex" : "none";
}
checkEmptyState();

/* === Filter Notes Cards === */
function filterCardsByTo(toValue) {
  const trimmed = (toValue || "").trim();
  const cards = cardsBox.querySelectorAll(".eval-card");
  const normalized = trimmed.toLowerCase();

  if (!trimmed || normalized === "@team") {
    cards.forEach(card => (card.style.display = ""));
    cardsHeader.textContent = "All Eval Cards (Group & Individual)";
    return;
  }

  cards.forEach(card => {
    const cardTo = (card.dataset.to || "").toLowerCase();
    card.style.display = cardTo === normalized ? "" : "none";
  });

  cardsHeader.textContent = `Eval Cards for ${trimmed}`;
}

/* === INPUT EVENTS === */
toInput.addEventListener("blur", () => {
  filterCardsByTo(toInput.value);
});

toInput.addEventListener("input", () => {
  const name = toInput.value.trim();
  renderWorkJournalCards(name);
});

/* === Add Notes Card === */
addBtn.onclick = () => {
  const to = toInput.value.trim();
  const priv = privateInput.value.trim();
  const pub = publicInput.value.trim();

  if (!to && !priv && !pub) return;

  if (to && to.toLowerCase() !== "@team") {
    journalUsers.add(to);
  }

  const time = new Date().toLocaleString();

  const card = document.createElement("div");
  card.className = "eval-card";
  card.dataset.to = to || "N/A";
  card.dataset.time = time;
  card.dataset.private = priv || "None";
  card.dataset.public = pub || "None";

  card.innerHTML = `
    <div class="card-to-name">${to || "N/A"}</div>
    <div class="card-date">${time}</div>
    <div class="eval-card-section"><strong>Private:</strong> ${priv || "None"}</div>
    <div class="eval-card-section"><strong>Public:</strong> ${pub || "None"}</div>
    <div class="more-btn">More</div>
  `;

  cardsBox.prepend(card);
  checkEmptyState();
  filterCardsByTo(to);

  toInput.value = "";
  privateInput.value = "";
  publicInput.value = "";
  updateDate();
};

/* === Notes Modal === */
cardsBox.onclick = e => {
  if (!e.target.classList.contains("more-btn")) return;

  const card = e.target.closest(".eval-card");
  if (!card) return;

  modalTo.textContent = "To: " + card.dataset.to;
  modalTime.textContent = card.dataset.time;
  modalPrivate.textContent = "Private: " + card.dataset.private;
  modalPublic.textContent = "Public: " + card.dataset.public;
  modal.style.display = "flex";
};

closeModal.onclick = () => {
  modal.style.display = "none";
};

modal.onclick = e => {
  if (e.target === modal) modal.style.display = "none";
};

/* === Journal Rendering === */
function renderWorkJournalCards(name) {
  const box = document.getElementById("workJournalBox");
  if (!box) return;

  box.innerHTML = "";

  if (!name) return;

  if (name.toLowerCase() === "@team" || name.toLowerCase() === "team") {
    journalUsers.forEach(user => {
      createJournalCard(box, user);
    });
    return;
  }

  createJournalCard(box, name);
}

function createJournalCard(box, name) {
  const card = document.createElement("div");
  card.className = "eval-card journal-card";

  card.innerHTML = `
    <div class="card-to-name">${name}</div>
    <div class="card-date">${new Date().toLocaleString()}</div>
    <div class="eval-card-section">Tasks: N/A</div>
    <div class="eval-card-section">Sentiment: N/A</div>
    <div class="eval-card-section">Mood Notes: N/A</div>
    <div class="eval-card-section">Reach Out: N/A</div>
    <div class="eval-card-section">Message: N/A</div>
  `;

  box.appendChild(card);
}
