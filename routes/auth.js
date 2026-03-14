const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../database/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`SELECT u.*, d.name AS department_name
              FROM users u
              LEFT JOIN departments d ON u.department_id = d.id
              WHERE u.email = @email AND u.is_active = 1`);

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      class: user.class,
      roll_number: user.roll_number,
      year: user.year,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.json({
      token,
      user: payload,
      redirect: `/${user.role}.html`,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout (stateless JWT — just instruct client to drop token)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
