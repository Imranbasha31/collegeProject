const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users — admin only
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT u.id, u.name, u.email, u.role, u.class, u.phone, u.roll_number, u.year,
             u.is_active, u.created_at, d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.role, u.name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users — admin creates user
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, password, role, department_id, class: cls, phone, roll_number, year } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'Name, email, password, and role are required' });

  try {
    const pool = await getPool();
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('hash', sql.NVarChar, hash)
      .input('role', sql.NVarChar, role)
      .input('dept', sql.Int, department_id || null)
      .input('class', sql.NVarChar, cls || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('roll', sql.NVarChar, roll_number || null)
      .input('year', sql.NVarChar, year || null)
      .query(`INSERT INTO users (name, email, password_hash, role, department_id, class, phone, roll_number, year)
              OUTPUT INSERTED.id VALUES (@name, @email, @hash, @role, @dept, @class, @phone, @roll, @year)`);
    res.status(201).json({ id: result.recordset[0].id, message: 'User created' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id — admin updates user
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, role, department_id, class: cls, phone, roll_number, year, is_active } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('role', sql.NVarChar, role)
      .input('dept', sql.Int, department_id || null)
      .input('class', sql.NVarChar, cls || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('roll', sql.NVarChar, roll_number || null)
      .input('year', sql.NVarChar, year || null)
      .input('active', sql.Bit, is_active !== undefined ? is_active : 1)
      .query(`UPDATE users SET name=@name, email=@email, role=@role, department_id=@dept,
              class=@class, phone=@phone, roll_number=@roll, year=@year, is_active=@active
              WHERE id = @id`);
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id — admin removes user (hard delete)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove your own account' });
    }

    const pool = await getPool();

    const exists = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT id FROM users WHERE id = @id');
    if (!exists.recordset.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.request()
      .input('id', sql.Int, userId)
      .query(`
        BEGIN TRANSACTION;

        -- Remove references to this user first to satisfy FK constraints.
        UPDATE departments SET hod_id = NULL WHERE hod_id = @id;
        UPDATE audit_logs SET actor_id = NULL WHERE actor_id = @id;

        DELETE FROM notifications WHERE user_id = @id;
        DELETE FROM approvals WHERE approver_id = @id;
        DELETE FROM approvals WHERE leave_id IN (SELECT id FROM leave_requests WHERE student_id = @id);
        DELETE FROM leave_requests WHERE student_id = @id;
        DELETE FROM users WHERE id = @id;

        COMMIT TRANSACTION;
      `);

    res.json({ message: 'User permanently removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/departments — for dropdowns
router.get('/departments', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM departments ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
