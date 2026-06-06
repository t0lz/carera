const { verifyToken } = require('../lib/security');

function requireAuth(req, res, next) {
  const value = req.get('authorization') || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';

  try {
    const payload = verifyToken(token);
    req.user = {
      user_id: Number(payload.sub),
      email: payload.email,
      role_name: payload.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'authentication_required' });
  }
}

function optionalAuth(req, _res, next) {
  const value = req.get('authorization') || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';

  if (!token) return next();

  try {
    const payload = verifyToken(token);
    req.user = {
      user_id: Number(payload.sub),
      email: payload.email,
      role_name: payload.role,
    };
  } catch {}

  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

function allowSelfOrAdmin(paramName = 'id') {
  return (req, res, next) => {
    const isSelf = Number(req.params[paramName]) === Number(req.user.user_id);
    if (!isSelf && req.user.role_name !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, allowRoles, allowSelfOrAdmin };
