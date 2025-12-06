// app/backend/routes/auth.js
const express = require("express");
const db = require("../db");
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
async function findRoleForEmail(email) {
  const normalizedEmail = (email || "").trim().toLowerCase();

  // 1) check user exists
  const userRes = await db.query(
    `SELECT id, email, display_name
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );
  if (userRes.rowCount === 0) {
    return { enrolled: false, role: null, user: null, course: null };
  }

  const user = userRes.rows[0];
  const userId = user.id;

  // 2) check enrollment in the default course
  const courseMembershipRes = await db.query(
    `SELECT course_id
     FROM course_memberships 
     WHERE user_id = $1 AND course_id = $2`,
    [userId, DEFAULT_COURSE_ID]
  );

  if (courseMembershipRes.rowCount === 0) {
    // user exists, but not enrolled in this course
    return { enrolled: false, role: null, user, course: null };
  }

  const courseId = courseMembershipRes.rows[0].course_id;

  // 3) find primary role for that course
  const roleRes = await db.query(
    `SELECT role
       FROM role_assignments
      WHERE user_id = $1
        AND course_id = $2
      LIMIT 1`,
    [userId, courseId]
  );

  const role = roleRes.rowCount > 0 ? roleRes.rows[0].role : null;

  // 4) (optional but nice) get course code/label for UI
  const courseInfoRes = await db.query(
    `SELECT c.id, c.code, c.name
       FROM courses c
      WHERE c.id = $1`,
    [courseId]
  );

  const course =
    courseInfoRes.rowCount > 0
      ? {
          id: courseInfoRes.rows[0].id,
          code: courseInfoRes.rows[0].code, // e.g., 'CSE 210'
          name: courseInfoRes.rows[0].name,
        }
      : { id: courseId, code: null, name: null };

  return {
    enrolled: true,
    role,
    user,
    course,
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
    const client = await getGoogleClient();

    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    console.log("START /auth/google/start session:", req.session);

    const url = client.authorizationUrl({
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account"
    });

    if (!url.startsWith("https://accounts.google.com/")) {
      console.error("Unexpected Google auth URL:", url);
      return res.status(500).send("Auth start error");
    }

    res.redirect(url);
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
const { enrolled, role, user, course } = await findRoleForEmail(claims.email);

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
  role, // 'admin' | 'professor' | 'student' | ...
  courseId: course?.id || DEFAULT_COURSE_ID,
  courseCode: course?.code || null,
  courseName: course?.name || null,
  emailVerified: Boolean(claims.email_verified),
  picture:
    typeof claims.picture === "string" ? claims.picture : null,
};

// Store on session for later use
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
