// script.js
// Shared logic for TA Work Evaluation dashboard + chat page

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const TEAMS = [
  {
    id: "team1",
    name: "Team 1",
    tag: "Graphs & Trees",
    students: [
      { id: "s1", name: "Alice Johnson", unread: true },
      { id: "s2", name: "Brian Kim", unread: false },
      { id: "s3", name: "Chloe Martinez", unread: true },
      { id: "s4", name: "Daniel Li", unread: false },
      { id: "s5", name: "Eva Singh", unread: false }
    ]
  },
  {
    id: "team2",
    name: "Team 2",
    tag: "Dynamic Programming",
    students: [
      { id: "s6", name: "Felix Ortega", unread: true },
      { id: "s7", name: "Grace Lee", unread: true },
      { id: "s8", name: "Hassan Ali", unread: false },
      { id: "s9", name: "Ivy Chen", unread: false },
      { id: "s10", name: "Jack Patel", unread: false }
    ]
  },
  {
    id: "team3",
    name: "Team 3",
    tag: "Sorting & Hashing",
    students: [
      { id: "s11", name: "Karan Mehta", unread: false },
      { id: "s12", name: "Lena Müller", unread: false },
      { id: "s13", name: "Mia Rossi", unread: true },
      { id: "s14", name: "Noah García", unread: false },
      { id: "s15", name: "Olivia Brown", unread: false }
    ]
  }
];

// Initial sample conversations (read-only defaults).
// Additional TA messages are stored per-student in localStorage.
const INITIAL_MESSAGES = {
  s1: [
    {
      from: "student",
      text: "Hi, I submitted my work but I'm not sure if my algorithm is O(n log n) or O(n^2).",
      timestamp: "2025-11-17T13:02:00"
    },
    {
      from: "ta",
      text: "Nice question! Can you explain what happens inside your inner loop in the worst case?",
      timestamp: "2025-11-17T13:05:00"
    }
  ],
  s3: [
    {
      from: "student",
      text: "I pushed an updated version of my solution. Could you skim the comments?",
      timestamp: "2025-11-18T10:25:00"
    }
  ],
  s6: [
    {
      from: "student",
      text: "I'm stuck on the base case for the DP question. Is it okay if I define it as dp[0] = 1?",
      timestamp: "2025-11-18T19:11:00"
    }
  ],
  s7: [
    {
      from: "student",
      text: "Just confirming: we only need to handle connected graphs, right?",
      timestamp: "2025-11-18T20:04:00"
    },
    {
      from: "ta",
      text: "Yes, for this assignment you can assume the input graph is connected.",
      timestamp: "2025-11-18T20:15:00"
    }
  ],
  s13: [
    {
      from: "student",
      text: "Can you check if my hash function is okay for the distribution of keys we discussed?",
      timestamp: "2025-11-19T08:42:00"
    }
  ]
};

// ---------------------------------------------------------------------------
// Helpers: Storage, lookup, formatting
// ---------------------------------------------------------------------------

function getStudentById(studentId) {
  for (const team of TEAMS) {
    const student = team.students.find((s) => s.id === studentId);
    if (student) {
      return { team, student };
    }
  }
  return null;
}

function getInitials(name) {
  if (!name) return "??";
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "??";
  const first = parts[0][0] || "";
  const second = parts.length > 1 ? parts[1][0] : "";
  return (first + second).toUpperCase();
}

function formatTimeShort(date) {
  if (!(date instanceof Date)) date = new Date(date);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hh = hours % 12 || 12;
  return `${hh}:${minutes} ${ampm}`;
}

function formatDayLabel(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

// Unread state is stored per student: key "taUnread_<studentId>" -> "true"/"false"
function getUnreadForStudent(studentId, defaultUnread) {
  const key = `taUnread_${studentId}`;
  const v = localStorage.getItem(key);
  if (v === "true") return true;
  if (v === "false") return false;
  return !!defaultUnread;
}

function setUnreadForStudent(studentId, unread) {
  const key = `taUnread_${studentId}`;
  localStorage.setItem(key, unread ? "true" : "false");
}

// Extra TA messages are stored per student in localStorage (so they survive refresh).
function getExtraMessages(studentId) {
  const key = `taMessages_${studentId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.warn("Could not parse stored messages for", studentId, e);
  }
  return [];
}

function appendExtraMessage(studentId, message) {
  const existing = getExtraMessages(studentId);
  existing.push(message);
  const key = `taMessages_${studentId}`;
  localStorage.setItem(key, JSON.stringify(existing));
}

// Combine initial + extra messages for a student.
function getAllMessagesForStudent(studentId) {
  const defaults = INITIAL_MESSAGES[studentId] || [];
  const extra = getExtraMessages(studentId);
  const all = [...defaults, ...extra];
  all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return all;
}

// Simple URL param reader
function getQueryParam(name) {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ---------------------------------------------------------------------------
// Teams page rendering (index.html)
// ---------------------------------------------------------------------------

function renderTeamsPage() {
  const container = document.getElementById("teams-container");
  if (!container) return;

  container.innerHTML = "";

  let totalStudents = 0;
  let unreadConversations = 0;
  let messagesToday = 0;

  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10); // YYYY-MM-DD

  TEAMS.forEach((team) => {
    const teamCard = document.createElement("div");
    teamCard.className = "team-card";

    const teamHeader = document.createElement("div");
    teamHeader.className = "team-header";

    const teamName = document.createElement("div");
    teamName.className = "team-name";
    teamName.textContent = team.name;

    const teamTag = document.createElement("div");
    teamTag.className = "team-tag";
    teamTag.textContent = team.tag;

    teamHeader.appendChild(teamName);
    teamHeader.appendChild(teamTag);

    const teamStats = document.createElement("div");
    teamStats.className = "team-stats";

    const list = document.createElement("ul");
    list.className = "student-list";

    let teamUnread = 0;

    team.students.forEach((student) => {
      totalStudents += 1;

      const hasUnread = getUnreadForStudent(student.id, student.unread);
      if (hasUnread) unreadConversations += 1;

      if (!INITIAL_MESSAGES[student.id] && getExtraMessages(student.id).length === 0) {
        // no previous messages at all, skip "today" count
      } else {
        const msgs = getAllMessagesForStudent(student.id);
        msgs.forEach((m) => {
          const d = new Date(m.timestamp);
          const isoDate = d.toISOString().slice(0, 10);
          if (isoDate === todayDate) messagesToday += 1;
        });
      }

      if (hasUnread) teamUnread += 1;

      const li = document.createElement("li");
      li.className = "student-row";
      li.dataset.studentId = student.id;

      const info = document.createElement("div");
      info.className = "student-info";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = getInitials(student.name);

      const nameMetaWrapper = document.createElement("div");
      nameMetaWrapper.style.display = "flex";
      nameMetaWrapper.style.flexDirection = "column";

      const nameSpan = document.createElement("div");
      nameSpan.className = "student-name";
      nameSpan.textContent = student.name;

      const metaSpan = document.createElement("div");
      metaSpan.className = "student-meta";
      const totalMsgs = getAllMessagesForStudent(student.id).length;
      metaSpan.textContent =
        totalMsgs > 0
          ? `${totalMsgs} message${totalMsgs > 1 ? "s" : ""} in thread`
          : "No messages yet";

      nameMetaWrapper.appendChild(nameSpan);
      nameMetaWrapper.appendChild(metaSpan);

      info.appendChild(avatar);
      info.appendChild(nameMetaWrapper);

      const right = document.createElement("div");
      right.className = "student-right";

      if (hasUnread) {
        const badge = document.createElement("div");
        badge.className = "unread-badge";
        const label = document.createElement("div");
        label.className = "unread-label";
        label.textContent = "New";
        right.appendChild(badge);
        right.appendChild(label);
      } else {
        const dot = document.createElement("div");
        dot.className = "read-dot";
        const label = document.createElement("div");
        label.className = "read-label";
        label.textContent = "Seen";
        right.appendChild(dot);
        right.appendChild(label);
      }

      li.appendChild(info);
      li.appendChild(right);

      li.addEventListener("click", () => {
        // Navigate to chat page with studentId as query
        window.location.href = `chat.html?studentId=${encodeURIComponent(student.id)}`;
      });

      list.appendChild(li);
    });

    teamStats.textContent = `${team.students.length} students • ${teamUnread} with new messages`;

    teamCard.appendChild(teamHeader);
    teamCard.appendChild(teamStats);
    teamCard.appendChild(list);

    container.appendChild(teamCard);
  });

  // Update side stats
  const statUnread = document.getElementById("stat-unread");
  const statTotal = document.getElementById("stat-total");
  const statToday = document.getElementById("stat-today");
  const summaryMeta = document.getElementById("team-summary-meta");

  if (statUnread) statUnread.textContent = String(unreadConversations);
  if (statTotal) statTotal.textContent = String(totalStudents);
  if (statToday) statToday.textContent = String(messagesToday);

  if (summaryMeta) {
    summaryMeta.textContent = `${TEAMS.length} teams • ${totalStudents} students • ${unreadConversations} active threads`;
  }
}

// ---------------------------------------------------------------------------
// Chat page rendering (chat.html)
// ---------------------------------------------------------------------------

function renderChatPage() {
  const bodyEl = document.getElementById("chat-body");
  if (!bodyEl) return;

  const studentId = getQueryParam("studentId");
  const studentInfo = studentId ? getStudentById(studentId) : null;

  const nameEl = document.getElementById("chat-student-name");
  const tagEl = document.getElementById("chat-team-tag");
  const subtitleEl = document.getElementById("chat-subtitle");
  const lastActivityEl = document.getElementById("chat-last-activity");
  const systemMsgEl = document.getElementById("chat-system-message");
  const avatarInitialsEl = document.getElementById("chat-avatar-initials");
  const msgCountLabel = document.getElementById("message-count-label");
  const backBtn = document.getElementById("back-btn");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  const errorBanner = document.getElementById("chat-error");
  const errorText = document.getElementById("chat-error-text");

  // Back button goes to teams page
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  if (!studentInfo) {
    // If no valid studentId, show error
    if (nameEl) nameEl.textContent = "Unknown student";
    if (subtitleEl) subtitleEl.textContent = "Student not found. Go back to the teams page.";
    if (tagEl) tagEl.textContent = "—";
    if (systemMsgEl) systemMsgEl.textContent = "This conversation could not be loaded.";
    if (lastActivityEl) lastActivityEl.textContent = "N/A";
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;
    return;
  }

  const { team, student } = studentInfo;

  if (nameEl) nameEl.textContent = student.name;
  if (tagEl) tagEl.textContent = team.name;
  if (subtitleEl) {
    subtitleEl.textContent = `Direct messages with ${student.name}. Use this space to give feedback and ask follow-ups.`;
  }
  if (avatarInitialsEl) {
    avatarInitialsEl.textContent = "TA";
  }

  // Mark conversation as read
  setUnreadForStudent(student.id, false);

  // Render messages
  function renderMessages() {
    const allMessages = getAllMessagesForStudent(student.id);
    bodyEl.innerHTML = "";

    if (!allMessages.length) {
      if (systemMsgEl) {
        systemMsgEl.textContent = "No messages yet. Start the conversation with a quick check-in!";
      }
      bodyEl.appendChild(systemMsgEl);
      if (msgCountLabel) msgCountLabel.textContent = "0 messages";
      if (lastActivityEl) lastActivityEl.textContent = "None yet";
      return;
    }

    let lastDayLabel = "";
    let lastMessageTime = null;

    const sys = document.createElement("div");
    sys.className = "system-message";
    sys.textContent = "This is the full history for this student (read-only for their past messages).";
    bodyEl.appendChild(sys);

    allMessages.forEach((message) => {
      const msgDate = new Date(message.timestamp);
      const dayLabel = formatDayLabel(msgDate);

      if (dayLabel !== lastDayLabel) {
        const divider = document.createElement("div");
        divider.className = "day-divider";
        divider.textContent = dayLabel;
        bodyEl.appendChild(divider);
        lastDayLabel = dayLabel;
      }

      const row = document.createElement("div");
      row.className = `message-row ${message.from === "ta" ? "ta" : "student"}`;

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.textContent = message.text;

      const timeLabel = document.createElement("div");
      timeLabel.className = "message-time";
      timeLabel.textContent = formatTimeShort(msgDate);

      row.appendChild(bubble);
      bodyEl.appendChild(row);
      bodyEl.appendChild(timeLabel);

      lastMessageTime = msgDate;
    });

    if (msgCountLabel) {
      const count = allMessages.length;
      msgCountLabel.textContent = `${count} message${count === 1 ? "" : "s"} in this thread`;
    }

    if (lastActivityEl && lastMessageTime) {
      lastActivityEl.textContent = `${formatDayLabel(lastMessageTime)}, ${formatTimeShort(lastMessageTime)}`;
    }

    // Scroll to bottom
    setTimeout(() => {
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }, 0);
  }

  renderMessages();

  // Sending a new TA message
  function sendMessage() {
    if (!input || !sendBtn) return;
    const text = input.value.trim();
    if (!text) return;

    try {
      const now = new Date();
      const message = {
        from: "ta",
        text,
        timestamp: now.toISOString()
      };

      appendExtraMessage(student.id, message);
      input.value = "";
      renderMessages();
      hideError();
    } catch (err) {
      console.error("Failed to send message", err);
      showError("Could not send message. Try again.");
    }
  }

  function showError(msg) {
    if (!errorBanner || !errorText) return;
    errorText.textContent = msg;
    errorBanner.classList.add("visible");
  }

  function hideError() {
    if (!errorBanner) return;
    errorBanner.classList.remove("visible");
  }

  if (sendBtn && input) {
    sendBtn.addEventListener("click", () => {
      sendMessage();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const pageType = document.body.dataset.page;

  if (pageType === "teams") {
    renderTeamsPage();
  } else if (pageType === "chat") {
    renderChatPage();
  }
});
