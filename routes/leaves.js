const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getPool, sql } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

// Multer storage for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `leave_${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── GET /api/leaves ──────────────────────────────────────────────────────────
// Returns leaves filtered by user role
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const { id, role, department_id, class: cls } = req.user;
    let query = '';

    const baseSelect = `
      SELECT lr.*, u.name as student_name, u.roll_number, u.class, u.year,
             d.name as department_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
    `;

    if (role === 'student') {
      query = baseSelect + ` WHERE lr.student_id = ${id} ORDER BY lr.created_at DESC`;
    } else if (role === 'advisor') {
      query = baseSelect + ` WHERE u.class = '${cls.replace(/'/g, "''")}' ORDER BY lr.created_at DESC`;
    } else if (role === 'hod') {
      query = baseSelect + ` WHERE u.department_id = ${department_id} ORDER BY lr.created_at DESC`;
    } else if (role === 'principal') {
      query = baseSelect + ` ORDER BY lr.created_at DESC`;
    } else if (role === 'admin') {
      query = baseSelect + ` ORDER BY lr.created_at DESC`;
    }

    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/leaves/:id ──────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = await getPool();
    const leaveResult = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT lr.*, u.name as student_name, u.roll_number, u.class, u.year, u.phone,
                     d.name as department_name
              FROM leave_requests lr
              JOIN users u ON lr.student_id = u.id
              LEFT JOIN departments d ON u.department_id = d.id
              WHERE lr.id = @id`);

    if (!leaveResult.recordset.length) return res.status(404).json({ error: 'Leave not found' });

    const approvalsResult = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT a.*, u.name as approver_name FROM approvals a
              JOIN users u ON a.approver_id = u.id
              WHERE a.leave_id = @id ORDER BY a.actioned_at ASC`);

    res.json({
      leave: leaveResult.recordset[0],
      approvals: approvalsResult.recordset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/leaves ────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('student'), async (req, res) => {
  const { leave_type, from_date, to_date, reason } = req.body;
  if (!leave_type || !from_date || !to_date || !reason)
    return res.status(400).json({ error: 'All fields are required' });

  const from = new Date(from_date);
  const to = new Date(to_date);
  if (to < from) return res.status(400).json({ error: 'To date must be after From date' });

  const diffTime = Math.abs(to - from);
  const total_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('sid', sql.Int, req.user.id)
      .input('type', sql.NVarChar, leave_type)
      .input('from', sql.Date, from_date)
      .input('to', sql.Date, to_date)
      .input('days', sql.Int, total_days)
      .input('reason', sql.NVarChar, reason)
      .query(`INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, total_days, reason)
              OUTPUT INSERTED.id VALUES (@sid, @type, @from, @to, @days, @reason)`);

    const leaveId = result.recordset[0].id;

    // Notify advisors of the student's class
    await notifyAdvisors(pool, req.user, leaveId);

    // Notify student
    await pool.request()
      .input('uid', sql.Int, req.user.id)
      .input('msg', sql.NVarChar, `Your ${leave_type} leave request (${from_date} to ${to_date}) has been submitted.`)
      .query('INSERT INTO notifications (user_id, message) VALUES (@uid, @msg)');

    res.status(201).json({ message: 'Leave submitted successfully', leaveId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/leaves/:id/approve ───────────────────────────────────────────
router.patch('/:id/approve', authenticate, authorize('advisor', 'hod', 'principal'), async (req, res) => {
  const { comment } = req.body;
  const leaveId = parseInt(req.params.id);
  const { id: approverId, role } = req.user;

  try {
    const pool = await getPool();
    const leaveResult = await pool.request()
      .input('id', sql.Int, leaveId)
      .query('SELECT * FROM leave_requests WHERE id = @id');

    const leave = leaveResult.recordset[0];
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    // Validate correct stage
    const stageMap = { advisor: 'pending_advisor', hod: 'pending_hod', principal: 'pending_principal' };
    if (leave.status !== stageMap[role])
      return res.status(400).json({ error: `Leave is not at ${role} stage` });

    // Determine next status
    const nextStatusMap = { advisor: 'pending_hod', hod: 'pending_principal', principal: 'approved' };
    const newStatus = nextStatusMap[role];

    await pool.request()
      .input('id', sql.Int, leaveId)
      .input('status', sql.NVarChar, newStatus)
      .query('UPDATE leave_requests SET status = @status, updated_at = GETDATE() WHERE id = @id');

    await pool.request()
      .input('lid', sql.Int, leaveId)
      .input('aid', sql.Int, approverId)
      .input('role', sql.NVarChar, role)
      .input('action', sql.NVarChar, 'approved')
      .input('comment', sql.NVarChar, comment || null)
      .query('INSERT INTO approvals (leave_id, approver_id, role, action, comment) VALUES (@lid, @aid, @role, @action, @comment)');

    // Notify student
    const studentMsg = newStatus === 'approved'
      ? `Your leave request #${leaveId} has been fully approved.`
      : `Your leave request #${leaveId} has been approved by ${role}. Forwarded to next level.`;
    await pool.request()
      .input('uid', sql.Int, leave.student_id)
      .input('msg', sql.NVarChar, studentMsg)
      .query('INSERT INTO notifications (user_id, message) VALUES (@uid, @msg)');

    // Notify next approver
    if (newStatus === 'pending_hod') await notifyHOD(pool, leave);
    if (newStatus === 'pending_principal') await notifyPrincipal(pool, leave);

    res.json({ message: `Leave approved by ${role}`, newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/leaves/:id/reject ────────────────────────────────────────────
router.patch('/:id/reject', authenticate, authorize('advisor', 'hod', 'principal'), async (req, res) => {
  const { comment } = req.body;
  const leaveId = parseInt(req.params.id);
  const { id: approverId, role } = req.user;

  try {
    const pool = await getPool();
    const leaveResult = await pool.request()
      .input('id', sql.Int, leaveId)
      .query('SELECT * FROM leave_requests WHERE id = @id');

    const leave = leaveResult.recordset[0];
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    const stageMap = { advisor: 'pending_advisor', hod: 'pending_hod', principal: 'pending_principal' };
    if (leave.status !== stageMap[role])
      return res.status(400).json({ error: `Leave is not at ${role} stage` });

    await pool.request()
      .input('id', sql.Int, leaveId)
      .query("UPDATE leave_requests SET status = 'rejected', updated_at = GETDATE() WHERE id = @id");

    await pool.request()
      .input('lid', sql.Int, leaveId)
      .input('aid', sql.Int, approverId)
      .input('role', sql.NVarChar, role)
      .input('action', sql.NVarChar, 'rejected')
      .input('comment', sql.NVarChar, comment || null)
      .query('INSERT INTO approvals (leave_id, approver_id, role, action, comment) VALUES (@lid, @aid, @role, @action, @comment)');

    // Notify student
    await pool.request()
      .input('uid', sql.Int, leave.student_id)
      .input('msg', sql.NVarChar, `Your leave request #${leaveId} has been rejected by ${role}. Reason: ${comment || 'No reason provided'}`)
      .query('INSERT INTO notifications (user_id, message) VALUES (@uid, @msg)');

    res.json({ message: `Leave rejected by ${role}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/leaves/:id/document ───────────────────────────────────────────
router.post('/:id/document', authenticate, authorize('student'), upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('path', sql.NVarChar, `/uploads/${req.file.filename}`)
      .query('UPDATE leave_requests SET document_path = @path WHERE id = @id AND student_id = ' + req.user.id);
    res.json({ message: 'Document uploaded', path: `/uploads/${req.file.filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function notifyAdvisors(pool, student, leaveId) {
  const advisors = await pool.request()
    .input('class', sql.NVarChar, student.class)
    .query("SELECT id FROM users WHERE role = 'advisor' AND class = @class");
  for (const a of advisors.recordset) {
    await pool.request()
      .input('uid', sql.Int, a.id)
      .input('msg', sql.NVarChar, `New leave request #${leaveId} from ${student.name} (${student.class}) awaiting your review.`)
      .query('INSERT INTO notifications (user_id, message) VALUES (@uid, @msg)');
  }
}

async function notifyHOD(pool, leave) {
  const student = await pool.request()
    .input('sid', sql.Int, leave.student_id)
    .query('SELECT u.*, d.hod_id FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = @sid');
  const hod_id = student.recordset[0]?.hod_id;
  if (hod_id) {
    await pool.request()
      .input('uid', sql.Int, hod_id)
      .input('msg', sql.NVarChar, `Leave request #${leave.id} has been forwarded by advisor and needs your approval.`)
      .query('INSERT INTO notifications (user_id, message) VALUES (@uid, @msg)');
  }
}

async function notifyPrincipal(pool, leave) {
  const principal = await pool.request()
    .query("SELECT id FROM users WHERE role = 'principal' AND is_active = 1");
  for (const p of principal.recordset) {
    await pool.request()
      .input('uid', sql.Int, p.id)
      .input('msg', sql.NVarChar, `Leave request #${leave.id} is ready for your final approval.`)
      .query('INSERT INTO notifications (user_id, message) VALUES (@uid, @msg)');
  }
}

module.exports = router;
