// backend/db/profile.js
const db = require('./index');

// Helper to ignore empty strings so blank inputs don't wipe existing data
function nonEmpty(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  return v;
}

async function createOrUpdateProfile(profile) {
  const {
    user_id,
    givenName,
    familyName,
    displayName,
    pronouns,
    namePronunciation,
    name_pronunciation, // allow snake_case from caller
    photo_url,
    photoUrl,
    phone,
    email,
    availabilityNotes,
    availabilityTime,
    availability_notes,
    publicLink,
    public_link,
    custom,
    clear = [],
  } = profile || {};

  if (!user_id) throw new Error('user_id is required for profile upsert');

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Update users table with only provided non-empty values
    const userSets = [];
    const userVals = [];
    let i = 1;
    const pushSet = (col, val) => {
      const n = nonEmpty(val);
      if (n !== undefined) {
        userSets.push(`${col} = $${i++}`);
        userVals.push(n);
      }
    };
    pushSet('given_name', givenName);
    pushSet('family_name', familyName);
    pushSet('display_name', displayName);
    pushSet('pronouns', pronouns);
    if (userSets.length) {
      userVals.push(user_id);
      await client.query(`UPDATE users SET ${userSets.join(', ')}, updated_at = now() WHERE id = $${i}`, userVals);
    }

    // Apply explicit clears in users table (set to NULL) if requested
    const userClears = [];
    if (Array.isArray(clear) && clear.length) {
      if (clear.includes('givenName')) userClears.push('given_name = NULL');
      if (clear.includes('familyName')) userClears.push('family_name = NULL');
      if (clear.includes('displayName')) userClears.push('display_name = NULL');
      if (clear.includes('pronouns')) userClears.push('pronouns = NULL');
    }
    if (userClears.length) {
      await client.query(`UPDATE users SET ${userClears.join(', ')}, updated_at = now() WHERE id = $1`, [user_id]);
    }

    // Normalize profile fields (prefer more specific/camelCase inputs)
    const finalNamePronunciation = nonEmpty(namePronunciation) ?? nonEmpty(name_pronunciation) ?? null;
    const finalPhotoUrl = nonEmpty(photo_url) ?? nonEmpty(photoUrl) ?? null;
    const finalPhone = nonEmpty(phone) ?? null;
    const finalEmail = nonEmpty(email) ?? null;
    const finalAvailability = nonEmpty(availabilityTime) ?? nonEmpty(availabilityNotes) ?? nonEmpty(availability_notes) ?? null;
    const finalPublicLink = nonEmpty(publicLink) ?? nonEmpty(public_link) ?? null;
    const finalCustom = nonEmpty(custom) ?? null;

    // Upsert profile (COALESCE keeps existing values when new is null)
    await client.query(
      `INSERT INTO user_profiles (user_id, name_pronunciation, photo_url, phone, email, availability_notes, public_link, custom, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'::jsonb), now())
       ON CONFLICT (user_id) DO UPDATE SET
         name_pronunciation = COALESCE(EXCLUDED.name_pronunciation, user_profiles.name_pronunciation),
         photo_url = COALESCE(EXCLUDED.photo_url, user_profiles.photo_url),
         phone = COALESCE(EXCLUDED.phone, user_profiles.phone),
         email = COALESCE(EXCLUDED.email, user_profiles.email),
         availability_notes = COALESCE(EXCLUDED.availability_notes, user_profiles.availability_notes),
         public_link = COALESCE(EXCLUDED.public_link, user_profiles.public_link),
         custom = COALESCE(EXCLUDED.custom, user_profiles.custom),
         updated_at = now()`,
      [
        user_id,
        finalNamePronunciation,
        finalPhotoUrl,
        finalPhone,
        finalEmail,
        finalAvailability,
        finalPublicLink,
        finalCustom,
      ],
    );

    // Apply explicit clears in profile table (set to NULL) if requested
    const profileClears = [];
    if (Array.isArray(clear) && clear.length) {
      if (clear.includes('namePronunciation') || clear.includes('name_pronunciation')) profileClears.push('name_pronunciation = NULL');
      if (clear.includes('photo_url') || clear.includes('photoUrl')) profileClears.push('photo_url = NULL');
      if (clear.includes('phone')) profileClears.push('phone = NULL');
      if (clear.includes('email')) profileClears.push('email = NULL');
      if (clear.includes('availabilityNotes') || clear.includes('availabilityTime') || clear.includes('availability_notes')) profileClears.push('availability_notes = NULL');
      if (clear.includes('publicLink') || clear.includes('public_link')) profileClears.push('public_link = NULL');
    }
    if (profileClears.length) {
      await client.query(`UPDATE user_profiles SET ${profileClears.join(', ')}, updated_at = now() WHERE user_id = $1`, [user_id]);
    }

    // Joined return
    const { rows } = await client.query(
      `SELECT u.id AS user_id, u.email AS user_email, u.given_name, u.family_name, u.display_name, u.pronouns,
              p.email AS profile_email, p.name_pronunciation, p.photo_url, p.phone,
              p.availability_notes, p.public_link, p.custom, p.updated_at
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [user_id],
    );

    await client.query('COMMIT');
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getProfileByUserId(userId) {
  if (!userId) return null;
  const { rows } = await db.query(
    `SELECT u.id AS user_id, u.email AS user_email, u.given_name, u.family_name, u.display_name, u.pronouns,
            p.email AS profile_email, p.name_pronunciation, p.photo_url, p.phone,
            p.availability_notes, p.public_link, p.custom, p.updated_at
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`
    , [userId]
  );
  return rows[0] || null;
}

async function getProfileByEmail(emailRaw) {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!email) return null;
  const { rows } = await db.query(
    `SELECT u.id AS user_id, u.email AS user_email, u.given_name, u.family_name, u.display_name, u.pronouns,
            p.email AS profile_email, p.name_pronunciation, p.photo_url, p.phone,
            p.availability_notes, p.public_link, p.custom, p.updated_at
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE LOWER(u.email) = $1 OR LOWER(p.email) = $1
     LIMIT 1`
    , [email]
  );
  return rows[0] || null;
}

module.exports = {
  createOrUpdateProfile,
  getProfileByUserId,
  getProfileByEmail,
};