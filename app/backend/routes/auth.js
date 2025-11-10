// app/backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { Issuer, generators } = require('openid-client');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
} = process.env;

// Cache the Google OIDC client (discover once)
let googleClientPromise;
async function getGoogleClient() {
  if (!googleClientPromise) {
    googleClientPromise = (async () => {
      const googleIssuer = await Issuer.discover('https://accounts.google.com');
      return new googleIssuer.Client({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uris: [GOOGLE_REDIRECT_URI],
        response_types: ['code'],
      });
    })();
  }
  return googleClientPromise;
}

// Start login
router.get('/google/start', async (req, res) => {
  try {
    const client = await getGoogleClient();

    // state + PKCE
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const url = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(url);
  } catch (e) {
    console.error('Auth start error:', e);
    res.status(500).send('Auth start error');
  }
});

// Callback
router.get('/google/callback', async (req, res) => {
  try {
    const { state, code } = req.query;
    if (!state || state !== req.session.oauthState) {
      return res.status(400).send('Invalid state');
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
    const safe = {
      sub: claims.sub,
      email: claims.email,
      email_verified: claims.email_verified,
      name: claims.name,
      picture: claims.picture,
    };

    res.send(`
      <h1>Google Login Successful</h1>
      <p><strong>Name:</strong> ${safe.name || ''}</p>
      <p><strong>Email:</strong> ${safe.email || ''} (${safe.email_verified ? 'verified' : 'unverified'})</p>
      <p><strong>Google sub:</strong> ${safe.sub}</p>
      ${safe.picture ? `<img src="${safe.picture}" style="height:80px;border-radius:50%;">` : ''}
      <pre>${JSON.stringify(safe, null, 2)}</pre>
      <a href="/">Back</a>
    `);
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.status(500).send('OAuth callback error');
  }
});

module.exports = router;
