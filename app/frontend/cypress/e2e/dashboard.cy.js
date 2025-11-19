describe("Student Dashboard UI", () => {
  beforeEach(() => {
    cy.visit("src/pages/dashboards/student.html");
  });

  it("loads the dashboard and displays header", () => {
    cy.get("h1").contains("Student Dashboard");
    cy.get("small").contains("CSE 210");
  });

  it("shows all dashboard cards", () => {
    cy.get(".dashboard-card").should("have.length.at.least", 4);
    cy.contains("Class Directory").should("exist");
    cy.contains("Task Tracker").should("exist");
    cy.contains("Meeting Notes").should("exist");
  });
});
