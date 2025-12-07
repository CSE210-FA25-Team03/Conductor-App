// app/backend/routes/auth.js
const express = require("express");
const db = require("../db");
const classDirectoryDb = require("../db/classDirectory");  // ⬅️ add this line
const router = express.Router();
const { Issuer, generators } = require("openid-client");


const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  DEFAULT_COURSE_ID: ENV_DEFAULT_COURSE_ID,
} = process.env;

// Use env course id if set, else fall back to demo course from schema_and_seed.sql
const DEFAULT_COURSE_ID =
  ENV_DEFAULT_COURSE_ID || "22222222-2222-2222-2222-222222222222";

// ------------------------------------------------------------
// Helper: find role for a user email from the database
// ------------------------------------------------------------
// ------------------------------------------------------------
// Helper: find role + core identity for a user email
// ------------------------------------------------------------
async function findRoleForEmail(email, options = {}) {
  // Reuse the same logic as the email-based login flow, so we stay in sync
  // with the current schema (courses.title, role_assignments, etc).
  const ctx = await classDirectoryDb.getUserCourseContextByEmail(email, options);

  // ctx shape (from db/classDirectory.js):
  // {
  //   user: { id, email, displayName } | null,
  //   courseId,
  //   courseCode,
  //   courseName,
  //   roles: [...],
  //   inCourse: boolean,
  //   isTeamLead: boolean,
  //   teamLeadTeams: [...],
  //   primaryRole: string | null,
  // }

  if (!ctx || !ctx.user) {
    return { enrolled: false, role: null, user: null, course: null };
  }

  // Match /api/auth/resolve-login behavior:
  // user must be in the course unless they are an admin.
  if (!ctx.inCourse && ctx.primaryRole !== "admin") {
    return { enrolled: false, role: null, user: ctx.user, course: null };
  }

  const role =
    ctx.primaryRole ||
    (Array.isArray(ctx.roles) && ctx.roles.length ? ctx.roles[0] : null);

  return {
    enrolled: true,
    role,
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      // Google callback currently expects "display_name" when building safeUser.name,
      // so we expose it here as well as displayName.
      display_name: ctx.user.displayName || ctx.user.email,
      displayName: ctx.user.displayName || ctx.user.email,
    },
    course: ctx.courseId
      ? {
          id: ctx.courseId,
          code: ctx.courseCode || null,
          name: ctx.courseName || null,
        }
      : null,
  };
}

// Cache the Google OIDC client (discover once)
let googleClientPromise;
async function getGoogleClient() {
  if (!googleClientPromise) {
    googleClientPromise = (async () => {
      const googleIssuer = await Issuer.discover(
        "https://accounts.google.com"
      );
      return new googleIssuer.Client({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uris: [GOOGLE_REDIRECT_URI],
        response_types: ["code"],
      });
    })();
  }
  return googleClientPromise;
}

router.get("/google/start", async (req, res) => {
  try {
    const classCode = (req.query.classCode || "").trim();

    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Save OAuth-related values in session
    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    // ✅ Save chosen class in session
    if (classCode) {
      req.session.pendingClassCode = classCode;
    } else {
      req.session.pendingClassCode = null;
    }

    // ✅ THIS is the missing line
    const client = await getGoogleClient();

    const authUrl = client.authorizationUrl({
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return res.redirect(authUrl);
  } catch (e) {
    console.error("Auth start error:", e);
    res.status(500).send("Auth start error");
  }
});


// --- OAuth callback ---
router.get("/google/callback", async (req, res) => {
  try {
    const { state, code } = req.query;
    if (!state || state !== req.session.oauthState) {
      return res.status(400).send("Invalid state");
    }

    const codeVerifier = req.session.codeVerifier;
    req.session.oauthState = undefined;
    req.session.codeVerifier = undefined;

    const client = await getGoogleClient();

    const tokenSet = await client.callback(
      GOOGLE_REDIRECT_URI,
      { state, code },
      { code_verifier: codeVerifier, state }
    );

    const claims = tokenSet.claims();

    // Look up enrollment + role in DB
const classCode = (req.session.pendingClassCode || "").trim();

const { enrolled, role, user, course } = await findRoleForEmail(
  claims.email,
  classCode ? { classCode } : {}
);

// Not enrolled in this course →
if (!enrolled) {
  console.warn("Login blocked: email not enrolled in course", claims.email);
  req.session = null;
  return res.redirect("/login/?error=not_enrolled");
}

// Enrolled but no role mapping →
if (!role) {
  console.warn("Login blocked: enrolled but no role", claims.email);
  req.session = null;
  return res.redirect("/login/?error=no_role");
}

// Build canonical session user
const safeUser = {
  id: user.id,
  email: user.email,
  name: user.display_name || claims.name || "",
  role, // 'admin', 'professor', 'student', ...
  courseId: course?.id || DEFAULT_COURSE_ID,
  courseCode: course?.code || classCode || null,
  courseName: course?.name || null,
  emailVerified: Boolean(claims.email_verified),
  picture: typeof claims.picture === "string" ? claims.picture : null,
};

req.session.user = safeUser;

    // Redirect back to frontend (e.g. dashboard or home)
    if (role === "admin") {
      return res.redirect("/admin/admin.html");
    } else if (role === "professor") {
      return res.redirect("/dashboards/professor.html");
    } else if (role === "student") {
      return res.redirect("/dashboards/student.html");
    } else if (role === "ta") {
      return res.redirect("/dashboards/ta.html");
    } else if (role === "team_lead") {
      return res.redirect("/dashboards/team_lead.html");
    } else {
      // should rarely happen if DB roles are consistent
      console.warn("Login blocked: unknown role", role, "for", claims.email);
      req.session = null;
      return res.redirect("/login/?error=unknown_role");
    }
  } catch (e) {
    console.error("OAuth callback error:", e);
    res.status(500).send("OAuth callback error");
  }
});


// --- Logout ---
router.post("/logout", (req, res) => {
  console.log("HIT /auth/logout before:", req.session);
  req.session = null; // cookie-session clears cookie
  console.log("HIT /auth/logout after:", req.session);
  return res.status(204).end(); // no body; frontend will redirect
});

// --- Return authenticated user ---
router.get("/me", (req, res) => {
  const user = req.session?.user;

  if (!user) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user,
  });
});

module.exports = router;
