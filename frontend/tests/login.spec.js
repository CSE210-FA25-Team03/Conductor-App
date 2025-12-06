import { describe, it, expect, beforeEach, vi } from 'vitest';

const successPayload = {
  success: true,
  user: { id: 'user-1', email: 'professor@school.edu', displayName: 'Ada Professor' },
  primaryRole: 'professor',
  redirectPath: '/dashboards/professor.html',
  roles: ['professor'],
  isTeamLead: false,
  teamLeadTeams: [],
};

function buildDom() {
  document.body.innerHTML = `
    <main>
      <form id="loginForm">
        <input id="firstname" value="Ada" />
        <input id="lastname" value="Professor" />
        <input id="email" />
        <button id="passwordToggle" type="button"></button>
        <input id="password" type="password" />
        <button type="submit">Submit</button>
      </form>
      <div id="successMessage" class="success-message"></div>
      <div id="loginError" class="error-message" style="display:none;"></div>
    </main>
  `;
}

describe('login page script', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    localStorage.clear();
    buildDom();

    // Mock fetch with branch on email
    vi.stubGlobal('fetch', vi.fn(async (_url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : {};
      if (body.email === 'fail@school.edu') {
        return new Response(JSON.stringify({ success: false, message: 'No user found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(successPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    // Allow overriding location for redirect
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('submits successfully, stores user, and redirects', async () => {
    await import('../src/pages/login_page/script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const email = document.getElementById('email');
    email.value = 'professor@school.edu';

    document.getElementById('passwordToggle').click();
    expect(document.getElementById('password').type).toBe('text');

    const form = document.getElementById('loginForm');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for async fetch and redirect timer (800ms in script)
    await new Promise((r) => setTimeout(r, 900));

    const stored = JSON.parse(localStorage.getItem('currentUser'));
    expect(stored?.email).toBe('professor@school.edu');
    expect(stored?.role).toBe('professor');
    expect(window.location.href).toBe('/dashboards/professor.html');
    expect(document.getElementById('successMessage')).toHaveClass('show');
  });

  it('shows an error when email is missing or login fails', async () => {
    await import('../src/pages/login_page/script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Missing email
    const form = document.getElementById('loginForm');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(document.getElementById('loginError').style.display).toBe('block');

    // Failed lookup
    document.getElementById('email').value = 'fail@school.edu';
    document.getElementById('loginError').style.display = 'none';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(document.getElementById('loginError').style.display).toBe('block');
  });
});
