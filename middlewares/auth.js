const jwt       = require('jsonwebtoken');
const { query } = require('../db');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      `SELECT id, name, email, role, is_active FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    req.user = rows[0];
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

module.exports = { authenticate, adminOnly };