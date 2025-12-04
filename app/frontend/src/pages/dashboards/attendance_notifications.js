// attendance_notifications.js
// Notification display for team leads when students update attendance

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
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
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser'));
      if (stored && stored.email) return stored;
    } catch {
      /* ignore */
    }

    const email = localStorage.getItem('email') || 'teamlead@school.edu';
    const role = localStorage.getItem('role') || 'team_lead';

    return {
      email,
      role,
      classId: 'CSE210',
    };
  }

  // ---------------------------------------------------------------------------
  // Load Notifications
  // ---------------------------------------------------------------------------
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    return;
  }

  // Check if user is a team lead
  const isTeamLead = currentUser.role === 'team_lead' || currentUser.isTeamLead;
  if (!isTeamLead) {
    return; // Not a team lead, don't show notifications
  }

  const email = currentUser.email.toLowerCase();
  const notificationsContainer = document.getElementById('attendanceNotifications');
  const notificationBadge = document.getElementById('attendanceNotificationBadge');

  if (!notificationsContainer) {
    return; // Notifications container not present on this page
  }

  async function loadNotifications() {
    try {
      const result = await fetchJSON(
        `${API_BASE}/attendance/weekly/notifications?email=${encodeURIComponent(email)}`,
      );

      const { notifications, unreadCount } = result || { notifications: [], unreadCount: 0 };

      // Update badge
      if (notificationBadge) {
        if (unreadCount > 0) {
          notificationBadge.textContent = unreadCount;
          notificationBadge.style.display = 'inline-block';
        } else {
          notificationBadge.style.display = 'none';
        }
      }

      // Render notifications
      if (notifications.length === 0) {
        notificationsContainer.innerHTML = '<p style="color: #777; padding: 1rem;">No notifications</p>';
        return;
      }

      notificationsContainer.innerHTML = notifications
        .map((notification) => {
          const date = new Date(notification.updatedAt).toLocaleDateString();
          const time = new Date(notification.updatedAt).toLocaleTimeString();
          const isReadClass = notification.isRead ? 'read' : 'unread';

          return `
            <div class="notification-item ${isReadClass}" data-notification-id="${notification.id}">
              <div class="notification-content">
                <div class="notification-header">
                  <strong>${notification.studentName}</strong>
                  ${notification.teamName ? `<span class="team-name">${notification.teamName}</span>` : ''}
                </div>
                <div class="notification-body">
                  Updated attendance for <strong>${notification.periodLabel || notification.periodStartDate}</strong>
                </div>
                <div class="notification-meta">
                  ${date} at ${time}
                </div>
              </div>
              ${!notification.isRead ? `
                <button class="mark-read-btn" data-id="${notification.id}">Mark as read</button>
              ` : ''}
            </div>
          `;
        })
        .join('');

      // Add event listeners for mark as read buttons
      notificationsContainer.querySelectorAll('.mark-read-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const notificationId = e.target.getAttribute('data-id');
          await markAsRead(notificationId);
        });
      });
    } catch (err) {
      console.error('Failed to load notifications:', err);
      notificationsContainer.innerHTML = '<p style="color: #b00020; padding: 1rem;">Failed to load notifications</p>';
    }
  }

  async function markAsRead(notificationId) {
    try {
      await fetchJSON(`${API_BASE}/attendance/weekly/notifications/${notificationId}/read`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      // Reload notifications
      await loadNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      alert('Failed to mark notification as read');
    }
  }

  // Load notifications on page load
  loadNotifications();

  // Refresh notifications every 30 seconds
  setInterval(loadNotifications, 30000);
});

