describe('Group formation page', () => {
  const skills = [
    { id: 's1', name: 'Frontend', weight: 1.5, position: 1 },
    { id: 's2', name: 'Backend', weight: 1.0, position: 2 },
  ];

  const studentRatings = [
    {
      user_id: 'u1',
      name: 'Alice',
      email: 'alice@school.edu',
      ratings: { Frontend: 3, Backend: 2 },
    },
    {
      user_id: 'u2',
      name: 'Bob',
      email: 'bob@school.edu',
      ratings: { Frontend: 2, Backend: 4 },
    },
  ];

  const groups = [
    {
      id: 'g1',
      name: 'Team Alpha',
      code: 'TEAM-A',
      taUserId: null,
      members: [
        { userId: 'u1', name: 'Alice', email: 'alice@school.edu', role: 'member' },
        { userId: 'u2', name: 'Bob', email: 'bob@school.edu', role: 'team_lead' },
      ],
    },
  ];

  beforeEach(() => {
    cy.intercept('GET', '/api/group-formation/skills', skills).as('getSkills');
    cy.intercept('GET', '/api/group-formation/student-ratings', studentRatings).as('getRatings');
    cy.intercept('GET', '/api/group-formation/groups', groups).as('getGroups');
    cy.intercept('POST', '/api/group-formation/groups', { message: 'Groups saved' }).as(
      'saveGroups',
    );
    cy.visit('/group_formation/group_formation.html');
  });

  it('loads skills, students, and groups tables', () => {
    cy.wait(['@getSkills', '@getRatings', '@getGroups']);

    cy.get('#skillsTable tbody tr').should('have.length', skills.length);
    cy.contains('#skillsTable tbody td', 'Frontend').should('exist');
    cy.contains('#skillsTable tbody td', 'Backend').should('exist');

    cy.get('#studentsTable tbody tr').should('have.length', studentRatings.length);
    cy.contains('#studentsTable tbody td', 'Alice').should('exist');
    cy.contains('#studentsTable tbody td', 'Bob').should('exist');

    cy.contains('#groupsTableBody tr td', 'Team Alpha').should('exist');
    cy.contains('#groupsTableBody tr td', 'Alice').should('exist');
    cy.contains('#groupsTableBody tr td', 'Bob').should('exist');
  });

  it('shows an empty state when no skills exist', () => {
    cy.intercept('GET', '/api/group-formation/skills', []).as('emptySkills');
    cy.visit('/group_formation/group_formation.html');
    cy.wait('@emptySkills');
    cy.contains('#skillsTable tbody td', 'No skills defined yet.').should('exist');
  });
});
