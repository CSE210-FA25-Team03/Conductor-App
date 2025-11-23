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

/* Modal Elements */
const modal = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const modalTo = document.getElementById("modalTo");
const modalTime = document.getElementById("modalTime");
const modalPrivate = document.getElementById("modalPrivate");
const modalPublic = document.getElementById("modalPublic");

let mode = "default";

/* Date */
function updateDate() {
  if (!dateDisplay) return;
  dateDisplay.textContent = new Date().toLocaleString();
}
updateDate();

/* Mode Toggle */
btnDefault.onclick = () => {
  mode = "default";
  btnDefault.classList.add("active");
  btnRubric.classList.remove("active");
  rubricPanel.style.display = "none";

  // reset emojis
  emojis.forEach(e => e.classList.remove("active"));
};

btnRubric.onclick = () => {
  mode = "rubric";
  btnRubric.classList.add("active");
  btnDefault.classList.remove("active");
  rubricPanel.style.display = "block";

  // reset emojis
  emojis.forEach(e => e.classList.remove("active"));
};

/* Emoji Click */
emojis.forEach(e => {
  e.onclick = () => {
    if (mode !== "default") return;
    emojis.forEach(x => x.classList.remove("active"));
    e.classList.add("active");
  };
});

/* Score Update */
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

scoreInputs.forEach(i => i.oninput = updateScore);

// === NEW: helper to filter eval cards by "To" value ===
function filterCardsByTo(toValue) {
  const trimmed = (toValue || "").trim();
  const cards = cardsBox.querySelectorAll(".eval-card");

  if (!cards.length) return;

  const normalized = trimmed.toLowerCase();

  // NEW: if empty OR "@Team", show all cards (team view / default view)
  if (!trimmed || normalized === "@team") {
    cards.forEach(card => {
      card.style.display = "";
    });

    if (cardsHeader) {
      cardsHeader.textContent = "All Eval Cards (Group & Individual)";
    }
    return;
  }

  // Otherwise, show only cards whose "to" exactly matches (case-insensitive)
  cards.forEach(card => {
    const cardTo = (card.dataset.to || "").toLowerCase();
    card.style.display = (cardTo === normalized) ? "" : "none";
  });

  if (cardsHeader) {
    cardsHeader.textContent = `Eval Cards for ${trimmed}`;
  }
}

// NEW: trigger filtering AFTER user finishes typing and clicks away from "To:"
if (toInput) {
  toInput.addEventListener("blur", () => {
    filterCardsByTo(toInput.value);
  });
}

// NEW (optional convenience): clicking the header clears filter & shows all cards
if (cardsHeader) {
  cardsHeader.addEventListener("click", () => {
    filterCardsByTo("");
    // also clear the input so it's obvious no filter is applied
    if (toInput) {
      toInput.value = "";
    }
  });
}

/* Add Card */
addBtn.onclick = () => {
  const to = toInput.value.trim();
  const priv = privateInput.value.trim();
  const pub = publicInput.value.trim();
  if (!to && !priv && !pub) return;

  const time = new Date().toLocaleString();

  const card = document.createElement("div");
  card.className = "eval-card";

  // dataset for modal
  card.dataset.to = to || "N/A";
  card.dataset.time = time;
  card.dataset.private = priv || "None";
  card.dataset.public = pub || "None";

  card.innerHTML = `
    <div class="eval-card-section"><strong>To:</strong> ${to || "N/A"}</div>
    <div class="eval-card-section">${time}</div>
    <div class="eval-card-section"><strong>Private:</strong> ${priv || "None"}</div>
    <div class="eval-card-section"><strong>Public:</strong> ${pub || "None"}</div>
    <div class="more-btn">More</div>
  `;

  cardsBox.prepend(card);

  // NEW: after adding a card, filter to this "To" value
  filterCardsByTo(to);

  // reset inputs
  toInput.value = "";
  privateInput.value = "";
  publicInput.value = "";

  updateDate();
};

/* Modal Open */
cardsBox.onclick = (e) => {
  if (!e.target.classList.contains("more-btn")) return;

  const card = e.target.closest(".eval-card");
  if (!card) return;

  modalTo.textContent = "To: " + card.dataset.to;
  modalTime.textContent = card.dataset.time;
  modalPrivate.textContent = "Private: " + card.dataset.private;
  modalPublic.textContent = "Public: " + card.dataset.public;

  modal.style.display = "flex";
};

/* Modal Close */
closeModal.onclick = () => {
  modal.style.display = "none";
};

modal.onclick = (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
};
