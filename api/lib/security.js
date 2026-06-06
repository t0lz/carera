const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'carera-development-secret-change-me';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  if (storedHash.startsWith('scrypt$')) {
    const [, salt, expected] = storedHash.split('$');
    const actual = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, 'hex');
    return expectedBuffer.length === actual.length &&
      crypto.timingSafeEqual(expectedBuffer, actual);
  }

  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(legacyHash),
    Buffer.from(String(storedHash))
  );
}

function signToken(user, expiresInSeconds = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: user.user_id,
    email: user.email,
    role: user.role_name,
    iat: now,
    exp: now + expiresInSeconds,
  }));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('invalid_token');

  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('invalid_token');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('token_expired');
  }
  return data;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
