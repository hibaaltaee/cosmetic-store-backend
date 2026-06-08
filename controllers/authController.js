const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { query } = require('../db');

// ─────────────────────────────────────────────
// POST /api/auth/login
// Public — no authentication needed
// ─────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate both fields exist
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // 2. Find user by email
    //    toLowerCase + trim handles 'Admin@Test.COM ' → 'admin@test.com'
    const { rows } = await query(
      `SELECT id, name, email, password, role, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // 3. User not found
   
    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const user = rows[0];

    // 4. Check if account is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    // 5. Compare plain password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // 6. Generate JWT token
    //    payload   → stored inside the token
    //    secret    → used to sign and verify
    //    expiresIn → token dies after 7 days
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 7. Send response — NEVER send the password back
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id:    user.id,
          name:  user.name,
          email: user.email,
          role:  user.role,
        },
      },
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/me
// Protected — authenticate middleware runs first
// req.user is already set — no DB query needed
// ─────────────────────────────────────────────
const getMe = (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
};

// ─────────────────────────────────────────────
// POST /api/auth/change-password
// Protected — authenticate middleware runs first
// ─────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Validate both fields exist
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both fields are required',
      });
    }

    // 2. Validate new password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
      });
    }

    // 3. Get current hashed password from DB
    //    req.user only has id, name, email, role — not password
    //    so we need to fetch it separately
    const { rows } = await query(
      `SELECT password FROM users WHERE id = $1`,
      [req.user.id]
    );

    // 4. Verify current password is correct
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // 5. Hash the new password
    //    12 = salt rounds → industry standard
    const hashed = await bcrypt.hash(newPassword, 12);

    // 6. Save new password to DB
    await query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [hashed, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/admin/users
// Admin only
// ─────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: rows,
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/admin/users
// Admin only — create a new staff account
// ─────────────────────────────────────────────
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'staff' } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    // 2. Hash the password before saving
    const hashed = await bcrypt.hash(password, 12);

    // 3. Insert new user — RETURNING gives us back the created row
    //    notice we don't select password in what we return
    const { rows } = await query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), hashed, role]
    );

    res.status(201).json({
      success: true,
      message: 'User created',
      data: rows[0],
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id/toggle
// Admin only — activate or deactivate a user
// ─────────────────────────────────────────────
const toggleUser = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE users
       SET is_active = NOT is_active
       WHERE id = $1 AND id != $2
       RETURNING id, name, email, role, is_active`,
      [req.params.id, req.user.id]
      //              ↑ prevents admin from deactivating themselves
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found or cannot modify yourself',
      });
    }

    res.json({
      success: true,
      message: `User ${rows[0].is_active ? 'activated' : 'deactivated'}`,
      data: rows[0],
    });

  } catch (err) {
    next(err);
  }
};

// export all functions
module.exports = { login, getMe, changePassword, getAllUsers, createUser, toggleUser };


      