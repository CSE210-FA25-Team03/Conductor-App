describe('Professor dashboard', () => {
  it('renders key cards and navigation links', () => {
    cy.visit('/dashboards/professor.html');

    cy.contains('h1', 'Staff Dashboard').should('be.visible');
    cy.contains('.dashboard-card h2', 'Class Directory').should('be.visible');
    cy.contains('.dashboard-card h2', 'Team Card').should('be.visible');
    cy.contains('.dashboard-card h2', 'Evaluation Journal').should('be.visible');
    cy.contains('.dashboard-card h2', 'Attendance').should('be.visible');

    cy.get('a[href="/class_config/class_config.html"]').should('exist');
    cy.get('a[href="/evaluation_rubric/evaluation_rubric.html"]').should('exist');
    cy.get('a[href="/group_formation/group_formation.html"]').should('exist');
    cy.get('a[href="/profile_page/profile.html"]').should('exist');
  });
});
