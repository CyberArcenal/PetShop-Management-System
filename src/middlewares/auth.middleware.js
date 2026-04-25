
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token and attach user to request.
 * Expects Authorization header: "Bearer <token>"
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user; // { id, username, email, role, ... }
    next();
  });
}

module.exports = { authenticateToken };