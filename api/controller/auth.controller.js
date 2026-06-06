const db = require('../db');
const {
  hashPassword,
  verifyPassword,
  signToken,
} = require('../lib/security');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return {
    user_id: row.user_id,
    email: row.email,
    firstname: row.firstname,
    lastname: row.lastname,
    phone: row.phone,
    role_id: row.role_id,
    role_name: row.role_name,
  };
}

exports.register = async (req, res) => {
  try {
    const { email, password, firstname, lastname, phone } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'weak_password' });
    }

    const roleResult = await db.query(
      `SELECT role_id, name
       FROM roles
       WHERE name IN ('user', 'buyer')
       ORDER BY CASE WHEN name = 'user' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    if (!roleResult.rows.length) {
      return res.status(500).json({ error: 'default_role_missing' });
    }

    const role = roleResult.rows[0];
    const passwordHash = hashPassword(password);
    const result = await db.query(
      `INSERT INTO users
        (email, password, password_hash, role_id, firstname, lastname, phone, created_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, NOW())
       RETURNING user_id, email, role_id, firstname, lastname, phone`,
      [
        normalizedEmail,
        passwordHash,
        role.role_id,
        String(firstname || '').trim() || null,
        String(lastname || '').trim() || null,
        String(phone || '').trim() || null,
      ]
    );

    const user = { ...result.rows[0], role_name: role.name };
    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    console.error('register error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email_already_used' });
    }
    res.status(500).json({ error: 'internal_error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = await db.query(
      `SELECT u.*, r.name AS role_name
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [String(email || '').trim()]
    );

    const user = result.rows[0];
    const storedHash = user && (user.password_hash || user.password);
    if (!user || !verifyPassword(String(password || ''), storedHash)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    if (!String(storedHash).startsWith('scrypt$')) {
      await db.query(
        'UPDATE users SET password = NULL, password_hash = $1 WHERE user_id = $2',
        [hashPassword(password), user.user_id]
      );
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};

exports.profile = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.user_id, u.email, u.firstname, u.lastname, u.phone,
              u.role_id, r.name AS role_name
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'not_found' });
    res.json(publicUser(result.rows[0]));
  } catch (err) {
    console.error('profile error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
};
