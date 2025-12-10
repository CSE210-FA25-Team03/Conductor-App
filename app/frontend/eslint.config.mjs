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
  // Ignore build output, config files, and Cypress support files (they use ES modules)
  {
    ignores: ["dist/**", "build/**", "eslint.config.mjs", "cypress/support/**"],
  },

  // 1) Cypress support files - explicit file match to ensure it's processed
  {
    files: ["cypress/support/e2e.js"],
    ...js.configs.recommended,
    languageOptions: {
      sourceType: "module",
      globals: {
        ...sanitizeGlobals(globals.browser),
        ...sanitizeGlobals(globals.mocha),
        ...sanitizeGlobals(globals.cypress),
        cy: "readonly",
        Cypress: "readonly",
      },
    },
  },

  // 1b) Other Cypress support files
  {
    files: ["cypress/support/**/*.js", "cypress/support/**/*.mjs"],
    ignores: ["cypress/support/e2e.js"], // Already handled above
    ...js.configs.recommended,
    languageOptions: {
      sourceType: "module",
      globals: {
        ...sanitizeGlobals(globals.browser),
        ...sanitizeGlobals(globals.mocha),
        ...sanitizeGlobals(globals.cypress),
        cy: "readonly",
        Cypress: "readonly",
      },
    },
  },

  // 2) Cypress config file (Node + CommonJS)
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

  // 3) Cypress E2E spec files (dashboard.cy.js, navigation.cy.js, etc.)
  {
    files: ["cypress/e2e/**/*.cy.{js,cjs,mjs}"],
    languageOptions: {
      // no imports/exports here, just plain test files
      sourceType: "script",
      globals: {
        ...sanitizeGlobals(globals.browser),   // window, document
        ...sanitizeGlobals(globals.mocha),     // describe, it, beforeEach, etc.
        ...sanitizeGlobals(globals.cypress),   // cy, Cypress
        cy: "readonly",                        // Explicitly add cy global
        Cypress: "readonly",                   // Explicitly add Cypress global
      },
    },
  },

  // 4) Regular frontend JS (your dashboard/task_tracker scripts, etc.)
  // Exclude ES module files and cypress support files - they're handled separately
  {
    files: [
      "src/**/*.{js,mjs,cjs}",
      "public/**/*.{js,mjs,cjs}",
      "!src/pages/common/auth.js",
      "!src/pages/dashboards/script.js",
      "!cypress/support/**"
    ],
    ...js.configs.recommended,
    languageOptions: {
      sourceType: "script",   // default: classic scripts
      globals: sanitizeGlobals(globals.browser),
    },
  },

  // 5) ES module frontend files loaded via <script type="module">
  {
    files: [
      "src/pages/common/**/*.{js,mjs}",
      "src/pages/dashboards/**/*.{js,mjs}"
    ],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      sourceType: "module",
      globals: sanitizeGlobals(globals.browser),
    },
  },

  // 5) ES Module files (using import/export)
  {
    files: ["src/pages/common/auth.js", "src/pages/dashboards/script.js"],
    ...js.configs.recommended,
    languageOptions: {
      sourceType: "module",
      globals: sanitizeGlobals(globals.browser),
    },
  },
]);
