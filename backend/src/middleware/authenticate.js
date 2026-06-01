require('dotenv').config();
const jwt = require('jsonwebtoken');

const blacklist = new Set();

function blacklistToken(token) {
  blacklist.add(token);
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Token requerido.' });
  }
  const token = header.slice(7);
  if (blacklist.has(token)) {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Sesión cerrada.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user  = payload;
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: 'Token inválido o expirado.' });
  }
}

module.exports = { authenticate, blacklistToken };
