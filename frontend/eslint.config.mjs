import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Ignore build output if you ever have it
  {
    ignores: ["dist/**", "build/**"],
  },

  // 1) Cypress config file (Node + CommonJS)
  {
    files: ["cypress.config.{js,mjs,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      // ignore unused on/config
      "no-unused-vars": "off",
    },
  },

  // 2) Cypress E2E spec files (dashboard.cy.js, navigation.cy.js, etc.)
  {
    files: ["cypress/e2e/**/*.cy.{js,cjs,mjs}"],
    languageOptions: {
      // no imports/exports here, just plain test files
      sourceType: "script",
      globals: {
        ...globals.browser,   // window, document
        ...globals.mocha,     // describe, it, beforeEach, etc.
        ...globals.cypress,   // cy, Cypress
      },
    },
  },

  // 3) Cypress support files (e.g. cypress/support/e2e.js uses import)
  {
    files: ["cypress/support/**/*.{js,mjs,cjs}"],
    languageOptions: {
      sourceType: "module",   // Cypress generates these as ES modules
      globals: {
        ...globals.browser,
        ...globals.mocha,
        ...globals.cypress,
      },
    },
  },

  // 4) Regular frontend JS (your dashboard/task_tracker scripts, etc.)
  {
    files: ["src/**/*.{js,mjs,cjs}", "public/**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      sourceType: "script",   // loaded via <script src="...">
      globals: globals.browser,
    },
  },
]);
