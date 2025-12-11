describe('Conductor Login Page UI', () => {
    beforeEach(() => {
        cy.visit('src/pages/login_page/login.html');
    });

    it('renders the login form with email, class code, and Google login', () => {

        cy.title().should('contain', 'Conductor App');
        cy.get('h3').should('contain', 'Welcome to');

        // Logo
        cy.get('.brand img.logo-full')
        .should('exist')
        .and('have.attr', 'alt', 'Conductor Tool Logo');

        // Form + inputs
        cy.get('form#loginForm').within(() => {
        cy.get('label[for="email"]').should('contain', 'Email');
        cy.get('input#email')
            .should('have.attr', 'type', 'email')
            .and('have.attr', 'required');

        cy.get('label[for="classCode"]').should('contain', 'Class Number');
        cy.get('input#classCode')
            .should('have.attr', 'type', 'text')
            .and('have.attr', 'required');

        cy.get('button[type="submit"]').should('contain', 'Login');
        });

        // Google login option
        cy.get('#googleLoginButton')
        .should('exist')
        .and('have.class', 'google-btn')
        .within(() => {
            cy.get('img[alt="Google"]').should('exist');
            cy.contains('span', 'Login with Google').should('exist');
        });

        cy.get('#successMessage')
            .should('exist')
            .and('contain', 'Taking you to your dashboard…');
            cy.get('#loginError').should('exist');
    });

    it('enforces HTML5 required validation on empty submit', () => {
        cy.get('button[type="submit"]').click();

        cy.get('#email:invalid').should('have.length', 1);
        cy.get('#classCode:invalid').should('have.length', 1);

        cy.get('#email').should('have.value', '');
        cy.get('#classCode').should('have.value', '');
    });
});

describe('Professor Dashboard UI (static smoke test)', () => {
    beforeEach(() => {
        cy.visit('src/pages/dashboards/professor.html');
    });

    it('shows the professor dashboard header with course label', () => {
        cy.get('.dashboard-header').within(() => {
        cy.get('h1').should('contain', 'Staff Dashboard');
        cy.get('small').should('contain', 'Professor view');
        });
    });

    it('shows the key dashboard cards for professor tools', () => {
        cy.get('.dashboard-card h2').then(($els) => {
        const titles = [...$els].map((el) => el.textContent.trim());
        cy.log('Professor dashboard card titles:', JSON.stringify(titles));
        });

        cy.get('.dashboard-card').should('have.length.at.least', 4);

        cy.contains('.dashboard-card h2', 'Class Directory', { matchCase: false }).should('exist');
        cy.contains('.dashboard-card h2', 'Team Card', { matchCase: false }).should('exist');
        cy.contains('.dashboard-card h2', 'Evaluation Journal', { matchCase: false }).should('exist');
        cy.contains('.dashboard-card h2', 'Attendance', { matchCase: false }).should('exist');
    });

    it('has navigation buttons visible with expected labels', () => {
        cy.get('#viewClassDirectoryBtn')
        .should('exist')
        .and('contain', 'Go to Class Hub');

        cy.get('#viewTeamsBtn')
        .should('exist')
        .and('contain', 'View Teams');

        cy.get('#viewEvalJournalBtn')
        .should('exist')
        .and('contain', 'Open Journal');

        cy.get('#viewAttendanceBtn')
        .should('exist')
        .and('contain', 'Open Attendance');

        cy.get('#viewAttendancePlotBtn')
        .should('exist')
        .and('contain', 'View Attendance');
    });
});

describe('Student Dashboard UI (static smoke test)', () => {
  beforeEach(() => {
    cy.visit('src/pages/dashboards/student.html');
  });

  it('shows the student dashboard header with course label', () => {
    cy.get('.dashboard-header').within(() => {
      cy.get('h1').should('contain', 'Student Dashboard');
      cy.get('small').should('contain', 'Student view');
    });

    cy.get('.page[data-role="student"]').should('exist');
  });

  it('shows the key dashboard cards for student tools', () => {
    cy.get('.dashboard-card h2').then(($els) => {
      const titles = [...$els].map((el) => el.textContent.trim());
      cy.log('Student dashboard card titles:', JSON.stringify(titles));
    });

    cy.get('.dashboard-card').should('have.length.at.least', 7);

    cy.contains('.dashboard-card h2', 'Class Directory', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'My Teams', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Task Tracker', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Work Journal', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Weekly Evaluation', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Submit Attendance', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'View Attendance', { matchCase: false }).should('exist');
  });

  it('has navigation and attendance buttons visible with expected labels', () => {
    // Main nav buttons
    cy.get('#viewClassDirectoryBtn')
      .should('exist')
      .and('contain', 'Go to Class Hub');

    cy.get('#viewTeamsBtn')
      .should('exist')
      .and('contain', 'View Teams');

    cy.get('#viewTasksBtn')
      .should('exist')
      .and('contain', 'View Tasks');

    cy.get('#viewWorkJournalBtn')
      .should('exist')
      .and('contain', 'Open Work Journal');

    // Weekly evaluation trigger
    cy.get('.dashboard-card')
      .contains('h2', 'Weekly Evaluation')
      .parents('.dashboard-card')
      .find('button.evaluation-trigger')
      .should('exist')
      .and('contain', 'View Evaluation');

    // Attendance buttons
    cy.get('#openAttendanceDrawer')
      .should('exist')
      .and('contain', 'Submit Attendance');

    cy.get('#viewAttendanceBtn')
      .should('exist')
      .and('contain', 'View Attendance');
  });

  it('renders the attendance drawer and plot panels in the DOM (hidden by default)', () => {
    cy.get('#attendancePanel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    cy.get('#attendancePlotPanel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    cy.get('#attendancePanel').within(() => {
      cy.contains('h2', 'Enter Attendance Code').should('exist');
      cy.get('#classAttendanceInput').should('exist');
      cy.get('#teamAttendanceInput').should('exist');
    });

    cy.get('#attendancePlotPanel').within(() => {
      cy.contains('h2', 'View Attendance').should('exist');
      cy.get('#teamAttendancePlot').should('exist');
      cy.get('#classAttendancePlot').should('exist');
    });
  });
});

describe('Teaching Assistant Dashboard UI (static smoke test)', () => {
  beforeEach(() => {
    cy.visit('src/pages/dashboards/ta.html');
  });

  it('shows the TA dashboard header with course label', () => {
    cy.get('.page[data-role="ta"]').should('exist');

    cy.get('.dashboard-header').within(() => {
      cy.get('h1').should('contain', 'Staff Dashboard');
      cy.get('small').should('contain', 'Teaching Assistant view');
    });
  });

  it('shows the key dashboard cards for TA tools', () => {
    cy.get('.dashboard-card h2').then(($els) => {
      const titles = [...$els].map((el) => el.textContent.trim());
      cy.log('TA dashboard card titles:', JSON.stringify(titles));
    });

    cy.get('.dashboard-card').should('have.length.at.least', 5);

    cy.contains('.dashboard-card h2', 'Class Directory', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Team Card', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Evaluation Journal', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Submit Attendance', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'View Attendance', { matchCase: false }).should('exist');
  });

  it('has navigation and attendance buttons visible with expected labels', () => {
    cy.get('#viewClassDirectoryBtn')
      .should('exist')
      .and('contain', 'Go to Class Hub');

    cy.get('#viewTeamsBtn')
      .should('exist')
      .and('contain', 'View Teams');

    cy.get('#viewEvalJournalBtn')
      .should('exist')
      .and('contain', 'Open Journal');

    cy.get('#openAttendanceDrawer')
      .should('exist')
      .and('contain', 'Submit Attendance');

    cy.get('#viewAttendancePlotBtn')
      .should('exist')
      .and('contain', 'View Attendance');
  });

  it('renders the TA attendance drawer and plot panel in the DOM (hidden by default)', () => {
    // Drawer present and hidden
    cy.get('#attendancePanel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    // Plot panel present and hidden
    cy.get('#attendancePlotPanel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    // Check key elements inside drawer
    cy.get('#attendancePanel').within(() => {
      cy.contains('h2', 'Weekly Attendance').should('exist');
      cy.get('#attendanceWeek').should('exist');
      cy.get('#attClass').should('exist');
      cy.get('#attGroup').should('exist');
      cy.get('#attOffice').should('exist');
      cy.get('#attClassMeeting').should('exist');
      cy.get('#saveAttendanceBtn').should('exist');
      cy.get('#pastAttendanceList').should('exist');
    });

    // Check key elements in plot panel
    cy.get('#attendancePlotPanel').within(() => {
      cy.contains('h2', 'View Attendance').should('exist');
      cy.get('#attendanceTeamSelect').should('exist');
      cy.get('#classAttendancePlot').should('exist');
    });
  });
});

describe('Team Lead Dashboard UI (static smoke test)', () => {
  beforeEach(() => {
    cy.visit('src/pages/dashboards/team_lead.html');
  });

  it('shows the team lead dashboard header with course label', () => {
    cy.get('.page[data-role="team-lead"]').should('exist');

    cy.get('.dashboard-header').within(() => {
      cy.get('h1').should('contain', 'Team Lead Dashboard');
      cy.get('small')
        .should('contain', 'Team Lead view');
    });
  });

  it('shows the key dashboard cards for team lead tools', () => {
    cy.get('.dashboard-card h2').then(($els) => {
      const titles = [...$els].map((el) => el.textContent.trim());
      cy.log('Team Lead dashboard card titles:', JSON.stringify(titles));
    });

    cy.get('.dashboard-card').should('have.length.at.least', 8);

    cy.contains('.dashboard-card h2', 'Class Directory', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'My Teams', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Team Task Tracker', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Work Journal', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Evaluation Journal', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Weekly Evaluation', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Generate Team Meeting Code', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Submit Attendance', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'View Attendance', { matchCase: false }).should('exist');
  });

  it('has navigation and attendance buttons visible with expected labels', () => {
    cy.get('#viewClassDirectoryBtn')
      .should('exist')
      .and('contain', 'Go to Class Hub');

    cy.get('#viewTeamsBtn')
      .should('exist')
      .and('contain', 'View Teams');

    cy.get('#viewTasksBtn')
      .should('exist')
      .and('contain', 'View Tasks');

    cy.get('#viewWorkJournalBtn')
      .should('exist')
      .and('contain', 'Open Notes');

    cy.get('#viewEvalJournalBtn')
      .should('exist')
      .and('contain', 'Open Journal');

    cy.contains('.dashboard-card button.card-btn', 'View Evaluation', { matchCase: false })
      .should('exist');

    cy.get('#openGenerateCodeDrawer')
      .should('exist')
      .and('contain', 'Generate Code');

    cy.get('#openAttendanceDrawer')
      .should('exist')
      .and('contain', 'Submit Attendance');

    cy.get('#viewAttendanceBtn')
      .should('exist')
      .and('contain', 'View Attendance');
  });

  it('renders the team lead drawers and panels in the DOM (hidden by default)', () => {
    // Generate Code drawer
    cy.get('#generateCodePanel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    cy.get('#generateCodePanel').within(() => {
      cy.contains('h2', 'Generate Team Meeting Code').should('exist');
      cy.get('#codeDuration').should('exist');
      cy.get('#generateCodeBtn').should('exist');
      cy.get('#currentCodeDisplay').should('exist');
      cy.get('#teamSessionsContainer').should('exist');
    });

    // Submit Attendance drawer
    cy.get('#attendancePanel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    cy.get('#attendancePanel').within(() => {
      cy.contains('h2', 'Submit Attendance').should('exist');
      cy.get('#classAttendanceInput').should('exist');
      cy.get('#classAttendanceSubmitBtn').should('exist');
      cy.get('#teamAttendanceInput').should('exist');
      cy.get('#teamAttendanceSubmitBtn').should('exist');
      cy.get('#classAttendanceRecordBody').should('exist');
      cy.get('#teamAttendanceRecordBody').should('exist');
    });

    // View Attendance plot panel
    cy.get('#attendancePlotPanel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    cy.get('#attendancePlotPanel').within(() => {
      cy.contains('h2', 'View Attendance').should('exist');
      cy.get('#teamAttendancePlot').should('exist');
      cy.get('#classAttendancePlot').should('exist');
    });

    // Weekly evaluation side panel
    cy.get('.evaluation-panel')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    cy.get('.evaluation-panel').within(() => {
      cy.contains('h2', 'Beacon AR · Team Lead').should('exist');
      cy.get('#lead-week').should('exist');
      cy.get('[data-eval-notes]').should('exist');
    });
  });
});
describe('Tutor Dashboard UI (static smoke test)', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (err.message && err.message.includes("Cannot read properties of null (reading 'addEventListener')")) {
        return false;
      }
      return true;
    });

    cy.visit('src/pages/dashboards/tutor.html');
  });

  it('shows the tutor dashboard header with course label', () => {
    cy.get('.page[data-role="tutor"]').should('exist');

    cy.get('.dashboard-header').within(() => {
      cy.get('h1').should('contain', 'Tutor Dashboard');
      cy.get('small')
        .should('contain', 'Tutor view'); 
    });
  });

  it('shows the primary tutor dashboard cards and FAQ section', () => {
    cy.get('.dashboard-card h2').then(($els) => {
      const titles = [...$els].map((el) => el.textContent.trim());
      cy.log('Tutor dashboard card titles:', JSON.stringify(titles));
    });

    // Two main cards + FAQ sidebar
    cy.get('.dashboard-card').should('have.length.at.least', 2);

    cy.contains('.dashboard-card h2', 'Class Directory', { matchCase: false }).should('exist');
    cy.contains('.dashboard-card h2', 'Ticket Queue', { matchCase: false }).should('exist');

    // FAQ right column / section
    cy.get('.tutor-right-column').should('exist');
    cy.get('.faq-section').within(() => {
      cy.contains('h3', 'Frequently Asked Questions').should('exist');
      cy.get('#addFaqBtn')
        .should('exist')
        .and('contain', 'Click to add Q&A');
      cy.get('#faqList').should('exist');
    });
  });

  it('has navigation and profile controls visible with expected elements', () => {
    // Profile avatar + dropdown shell
    cy.get('#dashboard-profile-img')
      .should('exist')
      .and('have.attr', 'alt', 'Profile');
    cy.get('#profileDropdown').should('exist');
    cy.get('#logoutBtn').should('exist').and('contain', 'Log Out');

    // Nav buttons wired in JS
    cy.get('#viewClassDirectoryBtn')
      .should('exist')
      .and('contain', 'Go to Class Hub');

    cy.get('#viewTicketsBtn')
      .should('exist')
      .and('contain', 'View Tickets');
  });

  it('renders the FAQ modal shell in the DOM (hidden overlay)', () => {
    cy.get('#faqModalOverlay')
      .should('exist')
      .and('have.attr', 'aria-hidden', 'true');

    cy.get('#faqModalOverlay').within(() => {
      cy.get('#faqModalTitle').should('contain', 'Add Q&A');
      cy.get('#faqQuestion').should('exist');
      cy.get('#faqAnswer').should('exist');

      cy.get('#faqSaveBtn')
        .should('exist')
        .and('contain', 'Save');

      cy.get('#faqCancelBtn')
        .should('exist')
        .and('contain', 'Cancel');

      cy.get('#faqDeleteBtn').should('exist');
    });
  });
});
