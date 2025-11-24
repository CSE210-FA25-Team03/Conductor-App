# **ADR: Adopt Cypress for Frontend End-to-End (E2E) Testing**

## **Context**

Our frontend currently has **no automated tests**. All verification is done manually by clicking through pages like:

* login page
* new user page
* dashboards
* task tracker
* tutor and profile pages

As the app grows, manual testing becomes slow, inconsistent, and error-prone.
We need a way to automatically verify that:

* navigation works
* DOM elements render correctly
* user flows behave as expected
* interactive UI components don’t break after changes

E2E testing is the appropriate level for our static HTML/CSS/JS frontend.

## **Decision**

We will adopt **Cypress** for frontend E2E testing.

**Team Members Involved:** Andrew Pan, Boqi Zhu
**Date:** 11/18/2025

## **Why Cypress?**

Cypress is the current industry standard for JavaScript E2E testing and fits our frontend perfectly.

### **Reasons We Chose Cypress**

* **Most popular E2E testing framework for modern JS apps**
* **Great developer experience — interactive test runner, auto-reload**
* **Zero setup to access DOM** — built-in JQuery-like API
* **Ideal for static HTML/CSS/JS**
* **Screenshots + video recordings out-of-the-box**
* **Excellent debugging tools**
* **Easy CI integration**
* **Simple tests that non-engineers (TA/professor) can read**

This makes Cypress the best tool to test full user flows like:

* logging in
* navigating from login → dashboard
* filling forms
* interacting with UI buttons
* verifying elements appear as expected

### **Why Not Other Tools?**

* **Playwright**

  * very powerful, but more suited for large production systems
  * more configuration than we need for a class project
* **Selenium/WebDriver**

  * older ecosystem
  * more complex setup
  * slower and harder to debug
* **Jest + DOM Testing Library**

  * great for unit/interaction tests
  * but not ideal for full browser-level testing

Given our timeline and frontend simplicity, Cypress is the most productive and beginner-friendly choice.

## **Alternatives Considered**

| Tool                       | Why Not Used                                                                |
| -------------------------- | --------------------------------------------------------------------------- |
| **Playwright**             | More configuration; heavier than we need                                    |
| **Selenium/WebDriver**     | Outdated, slow, more complex to maintain                                    |
| **No frontend tests**      | Too risky; UI regressions will go unnoticed                                 |
| **Jest + Testing Library** | Great for components, but we use static HTML—not a React/SPA component tree |

## **Outcome**

Cypress will be used to automate the most important user flows:

* login navigation
* student/TA/professor dashboards load correctly
* forms validate inputs
* task tracker UI behaves correctly

This dramatically reduces manual testing time and prevents UI regressions before merges.

## **Status**

**Planning for future adoption**
We will integrate Cypress in CI once basic E2E tests for login and role navigation are implemented.

