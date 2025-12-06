describe('Login page', () => {
  const userPayload = {
    success: true,
    user: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'professor@school.edu', displayName: 'Ada Professor' },
    primaryRole: 'professor',
    redirectPath: '/dashboards/professor.html',
    roles: ['professor'],
    isTeamLead: false,
    teamLeadTeams: [],
  };

  beforeEach(() => {
    cy.intercept('POST', '/api/auth/resolve-login', (req) => {
      const email = (req.body.email || '').toLowerCase();
      if (email === 'fail@school.edu') {
        req.reply({ statusCode: 404, body: { success: false, message: 'No user found' } });
      } else {
        req.reply({ statusCode: 200, body: userPayload });
      }
    }).as('resolveLogin');
  });

  it('renders the form and logs in successfully', () => {
    cy.visit('/login');
    cy.get('#firstname').type('Ada');
    cy.get('#lastname').type('Professor');
    cy.get('#email').type('professor@school.edu');
    cy.get('#password').type('password123');

    cy.get('#passwordToggle').click();
    cy.get('#password').should('have.attr', 'type', 'text');

    cy.get('#loginForm').submit();

    cy.wait('@resolveLogin').its('request.body.email').should('eq', 'professor@school.edu');
    cy.get('#successMessage').should('be.visible');

    cy.window().then((win) => {
      const stored = JSON.parse(win.localStorage.getItem('currentUser'));
      expect(stored.role).to.eq('professor');
      expect(stored.email).to.eq('professor@school.edu');
    });
  });

  it('shows an error on failed login', () => {
    cy.visit('/login');
    cy.get('#firstname').type('Test');
    cy.get('#lastname').type('User');
    cy.get('#email').type('fail@school.edu');
    cy.get('#password').type('anything');

    cy.get('#loginForm').submit();
    cy.wait('@resolveLogin');
    cy.get('#loginError').should('be.visible').and('contain', 'No user found');
  });
});
