// app/backend/routes/auth.js
const express = require("express");
const router = express.Router();
const { Issuer, generators } = require("openid-client");
const ADMIN_EMAILS = ["b2zhu@ucsd.edu"]; 
const PROF_EMAILS = ["prof@example.edu"]; // future
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

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

// --- Start login ---
router.get("/google/start", async (req, res) => {
  try {
    const client = await getGoogleClient();

    // state + PKCE
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const url = client.authorizationUrl({
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    // Basic safety check to satisfy security tools:
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

    // Only keep what we actually need in the session
    const safeUser = {
        sub: claims.sub,
        email: claims.email,
        emailVerified: Boolean(claims.email_verified),
        name: claims.name || "",
        picture: typeof claims.picture === "string" ? claims.picture : null,
        role: determineRole(claims.email)
    };

    // Store on session for later use
    req.session.user = safeUser;

    // Redirect back to frontend (e.g. dashboard or home)
    const role = safeUser.role;

    // in /google/callback
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
        return res.redirect("/login/"); // fallback
    }

  } catch (e) {
    console.error("OAuth callback error:", e);
    res.status(500).send("OAuth callback error");
  }
});

// --- Return authenticated user ---
router.get("/me", (req, res) => {
  const user = req.session?.user;

  if (!user) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user
  });
});



function determineRole(email) {
  if (ADMIN_EMAILS.includes(email)) return "admin";
  if (PROF_EMAILS.includes(email)) return "professor";
  // later: TA / student logic
  return "student";
}


module.exports = router;
