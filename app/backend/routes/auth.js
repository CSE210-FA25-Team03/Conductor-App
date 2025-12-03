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
async function findRoleForEmail(email) {
  // 1) check user exists
  const userRes = await db.query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (userRes.rowCount === 0) {
    return { enrolled: false, role: null };
  }

  const userId = userRes.rows[0].id;

  // 2) check enrollment in the default course
  const courseRes = await db.query(
    `SELECT id FROM course_memberships 
     WHERE user_id = $1 AND course_id = $2`,
    [userId, DEFAULT_COURSE_ID]       
  );
  if (courseRes.rowCount === 0) {
    return { enrolled: false, role: null };
  }

  // 3) check role assignments
  const roleRes = await db.query(
    `SELECT r.key AS role
     FROM role_assignments ra
     JOIN roles r ON r.id = ra.role_id
     WHERE ra.user_id = $1 
       AND ra.scope_type = 'course'
       AND ra.scope_id = $2`,
    [userId, DEFAULT_COURSE_ID]        
  );

  if (roleRes.rowCount === 0) {
    // enrolled in course, but no course-scoped role
    return { enrolled: true, role: null };
  }

  return { enrolled: true, role: roleRes.rows[0].role };  // e.g. 'admin', 'professor'
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
    const { enrolled, role } = await findRoleForEmail(claims.email);

    // Not enrolled in this course → refuse login
    if (!enrolled) {
      console.warn("Login blocked: email not enrolled in course", claims.email);
      req.session = null;
      return res.redirect("/login/?error=not_enrolled");
    }

    // Enrolled but no role mapping → separate error
    if (!role) {
      console.warn("Login blocked: enrolled but no role", claims.email);
      req.session = null;
      return res.redirect("/login/?error=no_role");
    }

    // Only keep what we actually need in the session
    const safeUser = {
      sub: claims.sub,
      email: claims.email,
      emailVerified: Boolean(claims.email_verified),
      name: claims.name || "",
      picture: typeof claims.picture === "string" ? claims.picture : null,
      role,  // e.g. 'admin', 'professor', 'student', 'ta', 'team_lead'
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
