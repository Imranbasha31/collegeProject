const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../database/db');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('uid', sql.Int, req.user.id)
      .query('SELECT * FROM notifications WHERE user_id = @uid ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('uid', sql.Int, req.user.id)
      .query('UPDATE notifications SET is_read = 1 WHERE id = @id AND user_id = @uid');
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/read-all (mark all read)
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('uid', sql.Int, req.user.id)
      .query('UPDATE notifications SET is_read = 1 WHERE user_id = @uid');
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
