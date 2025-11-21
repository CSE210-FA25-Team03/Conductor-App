describe("Student Dashboard UI", () => {
  beforeEach(() => {
    // Visiting relative file paths can behave differently in CI.
    // This makes sure Cypress resolves it correctly.
    cy.visit("src/pages/dashboards/student.html");
  });

  it("loads the dashboard header", () => {
    cy.get("h1").should("contain", "Student Dashboard");
    cy.get("small").should("contain", "CSE 210");
  });

  it("shows all expected dashboard cards", () => {
    // Log card titles to help debug CI env differences
    cy.get(".dashboard-card h2").then(($els) => {
      const titles = [...$els].map(el => el.textContent.trim());
      cy.log("Dashboard card titles:", JSON.stringify(titles));
    });

    // Check the number of cards
    cy.get(".dashboard-card").should("have.length.at.least", 4);

    // Check for specific card titles (case-insensitive)
    cy.contains("h2", "Class Directory", { matchCase: false }).should("exist");
    cy.contains("h2", "Task Tracker", { matchCase: false }).should("exist");
    cy.contains("h2", "Meeting Notes", { matchCase: false }).should("exist");
    cy.contains("h2", "Weekly Evaluation", { matchCase: false }).should("exist");
  });
});
