import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

function sanitizeGlobals(obj) {
  const cleaned = {};
  for (const [key, val] of Object.entries(obj || {})) {
    const k = (key || "").trim();
    if (!k) continue;
    cleaned[k] = val;
  }
  return cleaned;
}

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
      globals: sanitizeGlobals(globals.node),
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
        ...sanitizeGlobals(globals.browser),   // window, document
        ...sanitizeGlobals(globals.mocha),     // describe, it, beforeEach, etc.
        ...sanitizeGlobals(globals.cypress),   // cy, Cypress
      },
    },
  },

  // 3) Cypress support files (e.g. cypress/support/e2e.js uses import)
  {
    files: ["cypress/support/**/*.{js,mjs,cjs}"],
    languageOptions: {
      sourceType: "module",   // Cypress generates these as ES modules
      globals: {
        ...sanitizeGlobals(globals.browser),
        ...sanitizeGlobals(globals.mocha),
        ...sanitizeGlobals(globals.cypress),
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
      globals: sanitizeGlobals(globals.browser),
    },
  },
]);
