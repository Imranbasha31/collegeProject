const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/analytics/summary — counts by status, type, department
router.get('/summary', authenticate, authorize('admin', 'principal', 'hod'), async (req, res) => {
  try {
    const pool = await getPool();
    const { role, department_id } = req.user;

    const deptFilter = role === 'hod' ? `AND u.department_id = ${department_id}` : '';

    const statusCounts = await pool.request().query(`
      SELECT lr.status, COUNT(*) as count
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      WHERE 1=1 ${deptFilter}
      GROUP BY lr.status
    `);

    const typeCounts = await pool.request().query(`
      SELECT lr.leave_type, COUNT(*) as count
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      WHERE 1=1 ${deptFilter}
      GROUP BY lr.leave_type
    `);

    const deptCounts = await pool.request().query(`
      SELECT d.name as department, COUNT(lr.id) as count
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1 ${deptFilter}
      GROUP BY d.name
    `);

    const userStats = await pool.request().query(`
      SELECT role, COUNT(*) as count FROM users WHERE is_active = 1 GROUP BY role
    `);

    const totalResult = await pool.request().query(`
      SELECT COUNT(*) as total FROM leave_requests lr JOIN users u ON lr.student_id = u.id WHERE 1=1 ${deptFilter}
    `);

    res.json({
      total: totalResult.recordset[0].total,
      byStatus: statusCounts.recordset,
      byType: typeCounts.recordset,
      byDepartment: deptCounts.recordset,
      byUserRole: userStats.recordset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/trends — monthly leave counts for chart
router.get('/trends', authenticate, authorize('admin', 'principal', 'hod'), async (req, res) => {
  try {
    const pool = await getPool();
    const { role, department_id } = req.user;
    const deptFilter = role === 'hod' ? `AND u.department_id = ${department_id}` : '';

    const result = await pool.request().query(`
      SELECT FORMAT(lr.created_at, 'yyyy-MM') AS month, COUNT(*) AS count
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      WHERE lr.created_at >= DATEADD(MONTH, -6, GETDATE()) ${deptFilter}
      GROUP BY FORMAT(lr.created_at, 'yyyy-MM')
      ORDER BY month ASC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/export — CSV export
router.get('/export', authenticate, authorize('admin', 'principal'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT lr.id, u.name as student, u.roll_number, d.name as department, u.class,
             lr.leave_type, lr.from_date, lr.to_date, lr.total_days, lr.reason,
             lr.status, lr.created_at
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY lr.created_at DESC
    `);

    const rows = result.recordset;
    const headers = ['ID','Student','Roll No','Department','Class','Leave Type','From','To','Days','Reason','Status','Submitted On'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.id, `"${r.student}"`, r.roll_number || '', `"${r.department || ''}"`,
        `"${r.class || ''}"`, r.leave_type,
        r.from_date?.toISOString().split('T')[0],
        r.to_date?.toISOString().split('T')[0],
        r.total_days, `"${r.reason?.replace(/"/g, '""')}"`, r.status,
        r.created_at?.toISOString().split('T')[0]
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="approveiq_report.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
