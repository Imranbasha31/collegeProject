require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('./db');

const departments = [
  { name: 'Computer Science and Engineering' },
  { name: 'Information Technology' },
  { name: 'Electronics and Communication Engineering' },
  { name: 'Mechanical Engineering' },
];

const users = [
  // Admin
  { name: 'System Administrator', email: 'admin@approveiq.edu', password: 'admin123', role: 'admin', dept: null, class: null, phone: '9000000001', roll: null, year: null },
  // Principal
  { name: 'Dr. R. Krishnamurthy', email: 'principal@approveiq.edu', password: 'principal123', role: 'principal', dept: null, class: null, phone: '9000000002', roll: null, year: null },
  // HODs
  { name: 'Dr. S. Rajendran', email: 'hod.cse@approveiq.edu', password: 'hod123', role: 'hod', dept: 'Computer Science and Engineering', class: null, phone: '9000000003', roll: null, year: null },
  { name: 'Dr. P. Vijayalakshmi', email: 'hod.it@approveiq.edu', password: 'hod123', role: 'hod', dept: 'Information Technology', class: null, phone: '9000000004', roll: null, year: null },
  // Advisors
  { name: 'Mr. K. Suresh Kumar', email: 'advisor1@approveiq.edu', password: 'advisor123', role: 'advisor', dept: 'Computer Science and Engineering', class: 'CSE-A (III Year)', phone: '9000000005', roll: null, year: null },
  { name: 'Mrs. L. Priya Dharshini', email: 'advisor2@approveiq.edu', password: 'advisor123', role: 'advisor', dept: 'Computer Science and Engineering', class: 'CSE-B (III Year)', phone: '9000000006', roll: null, year: null },
  { name: 'Mr. M. Arun Prasad', email: 'advisor3@approveiq.edu', password: 'advisor123', role: 'advisor', dept: 'Information Technology', class: 'IT-A (II Year)', phone: '9000000007', roll: null, year: null },
  { name: 'Mrs. N. Kavitha Selvi', email: 'advisor4@approveiq.edu', password: 'advisor123', role: 'advisor', dept: 'Information Technology', class: 'IT-B (II Year)', phone: '9000000008', roll: null, year: null },
  // Students
  { name: 'Arjun Venkatesh', email: 'student1@approveiq.edu', password: 'student123', role: 'student', dept: 'Computer Science and Engineering', class: 'CSE-A (III Year)', phone: '9111111001', roll: 'CSE2021001', year: 'III' },
  { name: 'Kavya Ramachandran', email: 'student2@approveiq.edu', password: 'student123', role: 'student', dept: 'Computer Science and Engineering', class: 'CSE-A (III Year)', phone: '9111111002', roll: 'CSE2021002', year: 'III' },
  { name: 'Naveen Krishnaswamy', email: 'student3@approveiq.edu', password: 'student123', role: 'student', dept: 'Computer Science and Engineering', class: 'CSE-B (III Year)', phone: '9111111003', roll: 'CSE2021003', year: 'III' },
  { name: 'Divya Subramaniam', email: 'student4@approveiq.edu', password: 'student123', role: 'student', dept: 'Computer Science and Engineering', class: 'CSE-B (III Year)', phone: '9111111004', roll: 'CSE2021004', year: 'III' },
  { name: 'Rahul Murugesan', email: 'student5@approveiq.edu', password: 'student123', role: 'student', dept: 'Information Technology', class: 'IT-A (II Year)', phone: '9111111005', roll: 'IT2022001', year: 'II' },
  { name: 'Ananya Balakrishnan', email: 'student6@approveiq.edu', password: 'student123', role: 'student', dept: 'Information Technology', class: 'IT-A (II Year)', phone: '9111111006', roll: 'IT2022002', year: 'II' },
  { name: 'Vikram Sundaram', email: 'student7@approveiq.edu', password: 'student123', role: 'student', dept: 'Information Technology', class: 'IT-B (II Year)', phone: '9111111007', roll: 'IT2022003', year: 'II' },
  { name: 'Priya Natarajan', email: 'student8@approveiq.edu', password: 'student123', role: 'student', dept: 'Information Technology', class: 'IT-B (II Year)', phone: '9111111008', roll: 'IT2022004', year: 'II' },
];

async function seed() {
  const pool = await getPool();
  console.log('🌱 Starting seed...');

  // Clear existing data in correct order
  await pool.request().query('DELETE FROM audit_logs');
  await pool.request().query('DELETE FROM notifications');
  await pool.request().query('DELETE FROM approvals');
  await pool.request().query('DELETE FROM leave_requests');
  await pool.request().query('UPDATE departments SET hod_id = NULL');
  await pool.request().query('DELETE FROM users');
  await pool.request().query('DELETE FROM departments');

  // Insert departments
  const deptMap = {};
  for (const dept of departments) {
    const result = await pool.request()
      .input('name', sql.NVarChar, dept.name)
      .query('INSERT INTO departments (name) OUTPUT INSERTED.id VALUES (@name)');
    deptMap[dept.name] = result.recordset[0].id;
  }
  console.log('✅ Departments inserted');

  // Insert users
  const userMap = {};
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    const deptId = u.dept ? deptMap[u.dept] : null;
    const result = await pool.request()
      .input('name', sql.NVarChar, u.name)
      .input('email', sql.NVarChar, u.email)
      .input('hash', sql.NVarChar, hash)
      .input('role', sql.NVarChar, u.role)
      .input('dept', sql.Int, deptId)
      .input('class', sql.NVarChar, u.class)
      .input('phone', sql.NVarChar, u.phone)
      .input('roll', sql.NVarChar, u.roll)
      .input('year', sql.NVarChar, u.year)
      .query(`INSERT INTO users (name, email, password_hash, role, department_id, class, phone, roll_number, year)
              OUTPUT INSERTED.id
              VALUES (@name, @email, @hash, @role, @dept, @class, @phone, @roll, @year)`);
    userMap[u.email] = result.recordset[0].id;
  }
  console.log('✅ Users inserted');

  // Link HODs to departments
  await pool.request()
    .input('hodId', sql.Int, userMap['hod.cse@approveiq.edu'])
    .input('deptId', sql.Int, deptMap['Computer Science and Engineering'])
    .query('UPDATE departments SET hod_id = @hodId WHERE id = @deptId');
  await pool.request()
    .input('hodId', sql.Int, userMap['hod.it@approveiq.edu'])
    .input('deptId', sql.Int, deptMap['Information Technology'])
    .query('UPDATE departments SET hod_id = @hodId WHERE id = @deptId');
  console.log('✅ HODs linked to departments');

  // ── Sample leave requests ─────────────────────────────────────────────────

  // 1. Fully approved leave (student1)
  const r1 = await pool.request()
    .input('sid', sql.Int, userMap['student1@approveiq.edu'])
    .input('type', sql.NVarChar, 'medical')
    .input('from', sql.Date, '2026-02-10')
    .input('to', sql.Date, '2026-02-12')
    .input('days', sql.Int, 3)
    .input('reason', sql.NVarChar, 'Fever and throat infection — doctor advised rest for 3 days.')
    .input('status', sql.NVarChar, 'approved')
    .query(`INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, total_days, reason, status)
            OUTPUT INSERTED.id VALUES (@sid,@type,@from,@to,@days,@reason,@status)`);
  const l1 = r1.recordset[0].id;
  await pool.request()
    .input('lid', sql.Int, l1).input('aid', sql.Int, userMap['advisor1@approveiq.edu'])
    .input('role', sql.NVarChar, 'advisor').input('action', sql.NVarChar, 'approved')
    .input('comment', sql.NVarChar, 'Medical certificate verified. Approved.')
    .query('INSERT INTO approvals (leave_id,approver_id,role,action,comment) VALUES (@lid,@aid,@role,@action,@comment)');
  await pool.request()
    .input('lid', sql.Int, l1).input('aid', sql.Int, userMap['hod.cse@approveiq.edu'])
    .input('role', sql.NVarChar, 'hod').input('action', sql.NVarChar, 'approved')
    .input('comment', sql.NVarChar, 'Approved. Student to catch up on missed work.')
    .query('INSERT INTO approvals (leave_id,approver_id,role,action,comment) VALUES (@lid,@aid,@role,@action,@comment)');
  await pool.request()
    .input('lid', sql.Int, l1).input('aid', sql.Int, userMap['principal@approveiq.edu'])
    .input('role', sql.NVarChar, 'principal').input('action', sql.NVarChar, 'approved')
    .input('comment', sql.NVarChar, 'Approved.')
    .query('INSERT INTO approvals (leave_id,approver_id,role,action,comment) VALUES (@lid,@aid,@role,@action,@comment)');

  // 2. Pending at HOD (student2)
  const r2 = await pool.request()
    .input('sid', sql.Int, userMap['student2@approveiq.edu'])
    .input('type', sql.NVarChar, 'family')
    .input('from', sql.Date, '2026-03-05')
    .input('to', sql.Date, '2026-03-07')
    .input('days', sql.Int, 3)
    .input('reason', sql.NVarChar, 'Sister\'s wedding ceremony — family function.')
    .input('status', sql.NVarChar, 'pending_hod')
    .query(`INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, total_days, reason, status)
            OUTPUT INSERTED.id VALUES (@sid,@type,@from,@to,@days,@reason,@status)`);
  const l2 = r2.recordset[0].id;
  await pool.request()
    .input('lid', sql.Int, l2).input('aid', sql.Int, userMap['advisor1@approveiq.edu'])
    .input('role', sql.NVarChar, 'advisor').input('action', sql.NVarChar, 'approved')
    .input('comment', sql.NVarChar, 'Valid reason. Forwarded to HOD.')
    .query('INSERT INTO approvals (leave_id,approver_id,role,action,comment) VALUES (@lid,@aid,@role,@action,@comment)');

  // 3. Pending at Advisor (student3)
  await pool.request()
    .input('sid', sql.Int, userMap['student3@approveiq.edu'])
    .input('type', sql.NVarChar, 'personal')
    .input('from', sql.Date, '2026-03-08')
    .input('to', sql.Date, '2026-03-09')
    .input('days', sql.Int, 2)
    .input('reason', sql.NVarChar, 'Personal urgent work at hometown.')
    .input('status', sql.NVarChar, 'pending_advisor')
    .query(`INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, total_days, reason, status)
            OUTPUT INSERTED.id VALUES (@sid,@type,@from,@to,@days,@reason,@status)`);

  // 4. Rejected at Advisor (student4)
  const r4 = await pool.request()
    .input('sid', sql.Int, userMap['student4@approveiq.edu'])
    .input('type', sql.NVarChar, 'personal')
    .input('from', sql.Date, '2026-02-20')
    .input('to', sql.Date, '2026-02-22')
    .input('days', sql.Int, 3)
    .input('reason', sql.NVarChar, 'Going for a trip with friends.')
    .input('status', sql.NVarChar, 'rejected')
    .query(`INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, total_days, reason, status)
            OUTPUT INSERTED.id VALUES (@sid,@type,@from,@to,@days,@reason,@status)`);
  const l4 = r4.recordset[0].id;
  await pool.request()
    .input('lid', sql.Int, l4).input('aid', sql.Int, userMap['advisor2@approveiq.edu'])
    .input('role', sql.NVarChar, 'advisor').input('action', sql.NVarChar, 'rejected')
    .input('comment', sql.NVarChar, 'Exam preparation period. Leave not granted.')
    .query('INSERT INTO approvals (leave_id,approver_id,role,action,comment) VALUES (@lid,@aid,@role,@action,@comment)');

  // 5. Pending at Principal (student5)
  const r5 = await pool.request()
    .input('sid', sql.Int, userMap['student5@approveiq.edu'])
    .input('type', sql.NVarChar, 'academic')
    .input('from', sql.Date, '2026-03-10')
    .input('to', sql.Date, '2026-03-12')
    .input('days', sql.Int, 3)
    .input('reason', sql.NVarChar, 'National level hackathon at IIT Madras. Event participation letter attached.')
    .input('status', sql.NVarChar, 'pending_principal')
    .query(`INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, total_days, reason, status)
            OUTPUT INSERTED.id VALUES (@sid,@type,@from,@to,@days,@reason,@status)`);
  const l5 = r5.recordset[0].id;
  await pool.request()
    .input('lid', sql.Int, l5).input('aid', sql.Int, userMap['advisor3@approveiq.edu'])
    .input('role', sql.NVarChar, 'advisor').input('action', sql.NVarChar, 'approved')
    .input('comment', sql.NVarChar, 'Academic event. Forwarded.')
    .query('INSERT INTO approvals (leave_id,approver_id,role,action,comment) VALUES (@lid,@aid,@role,@action,@comment)');
  await pool.request()
    .input('lid', sql.Int, l5).input('aid', sql.Int, userMap['hod.it@approveiq.edu'])
    .input('role', sql.NVarChar, 'hod').input('action', sql.NVarChar, 'approved')
    .input('comment', sql.NVarChar, 'Good initiative. Forwarded to Principal.')
    .query('INSERT INTO approvals (leave_id,approver_id,role,action,comment) VALUES (@lid,@aid,@role,@action,@comment)');

  // Seed notifications
  const notifs = [
    { user: 'student1@approveiq.edu', msg: 'Your medical leave (Feb 10-12) has been approved by the Principal.' },
    { user: 'student2@approveiq.edu', msg: 'Your family leave request is pending HOD approval.' },
    { user: 'student3@approveiq.edu', msg: 'Your leave request has been submitted and is pending Advisor review.' },
    { user: 'student4@approveiq.edu', msg: 'Your personal leave request has been rejected. Reason: Exam preparation period.' },
    { user: 'student5@approveiq.edu', msg: 'Your academic leave is pending Principal\'s final approval.' },
    { user: 'advisor1@approveiq.edu', msg: 'You have 1 pending leave request awaiting your review.' },
    { user: 'hod.cse@approveiq.edu', msg: 'A leave request from Kavya Ramachandran is pending your approval.' },
    { user: 'principal@approveiq.edu', msg: 'A leave request from Rahul Murugesan is pending your final approval.' },
  ];
  for (const n of notifs) {
    await pool.request()
      .input('uid', sql.Int, userMap[n.user])
      .input('msg', sql.NVarChar, n.msg)
      .query('INSERT INTO notifications (user_id, message) VALUES (@uid, @msg)');
  }

  console.log('✅ Leave requests, approvals, and notifications seeded');
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin:     admin@approveiq.edu      / admin123');
  console.log('   Principal: principal@approveiq.edu  / principal123');
  console.log('   HOD (CSE): hod.cse@approveiq.edu   / hod123');
  console.log('   HOD (IT):  hod.it@approveiq.edu    / hod123');
  console.log('   Advisor:   advisor1@approveiq.edu   / advisor123');
  console.log('   Student:   student1@approveiq.edu   / student123');
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed error:', err); process.exit(1); });
