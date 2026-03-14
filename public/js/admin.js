// ── Admin Dashboard JS ────────────────────────────────────────────────────────
let user = null;
let allUsers = [];
let allLeaves = [];
let editingUserId = null;
let pendingRemoveUserId = null;
let departments = [];
let typeChartInst, trendChartInst, deptChartInst;
let typeChart2Inst, trendChart2Inst, deptChart2Inst;

function buildLastSixMonthSeries(raw = []) {
  const now = new Date();
  const keys = [];

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    keys.push(key);
  }

  const counts = new Map(raw.map((row) => [row.month, Number(row.count) || 0]));

  return keys.map((key) => {
    const [year, month] = key.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    return { month: label, count: counts.get(key) || 0 };
  });
}

function compactDepartmentLabel(name) {
  const raw = (name || 'Unknown').trim();
  const map = {
    'Computer Science and Engineering': 'CSE',
    'Information Technology': 'IT',
    'Electronics and Communication Engineering': 'ECE',
    'Mechanical Engineering': 'ME',
    'Civil Engineering': 'CE',
  };
  if (map[raw]) return map[raw];
  if (raw.length > 16) return `${raw.slice(0, 14)}..`;
  return raw;
}

document.addEventListener('DOMContentLoaded', async () => {
  user = API.requireAuth(['admin']);
  if (!user) return;
  document.getElementById('userName').textContent = user.name;
  document.getElementById('avatarInitial').textContent = user.name[0].toUpperCase();
  await Promise.all([loadDashboard(), loadUsers(), loadDepartments(), loadLeaves()]);
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [summary, trends] = await Promise.all([
      API.get('/analytics/summary'),
      API.get('/analytics/trends'),
    ]);

    // KPI cards
    const totalUsers = summary.byUserRole.reduce((sum, r) => sum + r.count, 0);
    document.getElementById('kpi-users').textContent = totalUsers;
    document.getElementById('kpi-leaves').textContent = summary.total;

    let pending = 0, approved = 0, rejected = 0;
    summary.byStatus.forEach(s => {
      if (s.status.startsWith('pending')) pending += s.count;
      else if (s.status === 'approved') approved = s.count;
      else if (s.status === 'rejected') rejected = s.count;
    });
    document.getElementById('kpi-pending').textContent = pending;
    document.getElementById('kpi-approved').textContent = approved;
    document.getElementById('kpi-rejected').textContent = rejected;

    // Charts
    renderTypeChart('typeChart', summary.byType, typeChartInst, (i) => typeChartInst = i);
    renderTrendChart('trendChart', buildLastSixMonthSeries(trends), trendChartInst, (i) => trendChartInst = i);
    renderDeptChart('deptChart', summary.byDepartment, deptChartInst, (i) => deptChartInst = i);
  } catch(e) { console.error(e); }
}

async function loadAnalytics() {
  try {
    const [summary, trends] = await Promise.all([
      API.get('/analytics/summary'),
      API.get('/analytics/trends'),
    ]);

    let pending = 0, approved = 0, rejected = 0;
    summary.byStatus.forEach(s => {
      if (s.status.startsWith('pending')) pending += s.count;
      else if (s.status === 'approved') approved = s.count;
      else if (s.status === 'rejected') rejected = s.count;
    });
    document.getElementById('a-kpi-total').textContent = summary.total;
    document.getElementById('a-kpi-pending').textContent = pending;
    document.getElementById('a-kpi-approved').textContent = approved;
    document.getElementById('a-kpi-rejected').textContent = rejected;

    renderTypeChart('typeChart2', summary.byType, typeChart2Inst, (i) => typeChart2Inst = i);
    renderTrendChart('trendChart2', buildLastSixMonthSeries(trends), trendChart2Inst, (i) => trendChart2Inst = i);
    renderDeptChart('deptChart2', summary.byDepartment, deptChart2Inst, (i) => deptChart2Inst = i);
  } catch(e) { console.error(e); }
}

function renderTypeChart(canvasId, data, existingInstance, setter) {
  if (existingInstance) existingInstance.destroy();
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const labels = data.map(d => d.leave_type.charAt(0).toUpperCase()+d.leave_type.slice(1));
  const values = data.map(d => d.count);
  const colors = ['#4f46e5', '#8b5cf6', '#22c55e', '#f59e0b', '#06b6d4'];
  setter(new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10,
        spacing: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 180,
      animation: { duration: 450 },
      cutout: '48%',
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#475569',
            font: { family: 'Inter', size: 11, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
          },
        },
        tooltip: {
          backgroundColor: '#0b1220',
          titleColor: '#e2e8f0',
          bodyColor: '#cbd5e1',
          borderColor: '#1e293b',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (context) => `${context.label}: ${context.raw}`,
          },
        },
      },
    },
  }));
}

function renderTrendChart(canvasId, data, existingInstance, setter) {
  if (existingInstance) existingInstance.destroy();
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const labels = data.map(d => d.month);
  const values = data.map(d => Number(d.count) || 0);
  const fillGradient = ctx.createLinearGradient(0, 0, 0, 280);
  fillGradient.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
  fillGradient.addColorStop(1, 'rgba(37, 99, 235, 0.03)');

  setter(new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Leave Requests',
        data: values,
        borderColor: '#2563eb',
        backgroundColor: fillGradient,
        fill: true,
        tension: 0.42,
        pointBackgroundColor: '#1d4ed8',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 180,
      animation: { duration: 500 },
      normalized: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#64748b',
            font: { family: 'Inter', size: 11, weight: '600' },
          },
        },
        tooltip: {
          backgroundColor: '#0b1220',
          titleColor: '#e2e8f0',
          bodyColor: '#cbd5e1',
          borderColor: '#1e293b',
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 11, family: 'Inter', weight: '500' } },
          grid: { color: 'rgba(148,163,184,0.16)', drawBorder: false },
        },
        y: {
          ticks: {
            color: '#64748b',
            stepSize: 1,
            font: { size: 11, family: 'Inter', weight: '500' },
            callback: (value) => Number.isInteger(value) ? value : '',
          },
          grid: { color: 'rgba(148,163,184,0.16)', drawBorder: false },
          beginAtZero: true,
          suggestedMax: Math.max(5, ...values) + 1,
        },
      }
    },
  }));
}

function renderDeptChart(canvasId, data, existingInstance, setter) {
  if (existingInstance) existingInstance.destroy();
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const labels = data.map(d => compactDepartmentLabel(d.department));
  const values = data.map(d => d.count);
  const barGradient = ctx.createLinearGradient(0, 0, 0, 320);
  barGradient.addColorStop(0, 'rgba(79, 70, 229, 0.9)');
  barGradient.addColorStop(1, 'rgba(59, 130, 246, 0.5)');

  setter(new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Leaves',
        data: values,
        backgroundColor: barGradient,
        borderColor: '#4f46e5',
        borderWidth: 1,
        borderRadius: 10,
        maxBarThickness: 64,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 180,
      animation: { duration: 450 },
      normalized: true,
      plugins: {
        legend: {
          labels: {
            color: '#64748b',
            font: { family: 'Inter', size: 11, weight: '600' },
          },
        },
        tooltip: {
          backgroundColor: '#0b1220',
          titleColor: '#e2e8f0',
          bodyColor: '#cbd5e1',
          borderColor: '#1e293b',
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#64748b',
            maxRotation: 0,
            autoSkip: false,
            font: { size: 10, family: 'Inter', weight: '600' },
          },
          grid: { color: 'rgba(148,163,184,0.16)', drawBorder: false },
        },
        y: {
          ticks: { color: '#64748b', stepSize: 1, font: { size: 11, family: 'Inter', weight: '500' } },
          grid: { color: 'rgba(148,163,184,0.16)', drawBorder: false },
          beginAtZero: true,
        },
      }
    },
  }));
}

// ── User Management ───────────────────────────────────────────────────────────
async function loadUsers() {
  try {
    allUsers = await API.get('/users');
    renderUsers(allUsers);
  } catch(e) {
    document.getElementById('usersBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger)">${e.message}</td></tr>`;
  }
}

async function loadDepartments() {
  try {
    departments = await API.get('/users/departments');
    const sel = document.getElementById('u-dept');
    sel.innerHTML = '<option value="">None</option>' + departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  } catch(e) {}
}

function renderUsers(users) {
  const tbody = document.getElementById('usersBody');
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><h3>No users found</h3></div></td></tr>`;
    return;
  }
  const roleColors = { admin:'badge-danger', principal:'badge-purple', hod:'badge-info', advisor:'badge-success', student:'badge-secondary' };
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:#fff;flex-shrink:0">${u.name[0]}</div>
          <span style="font-weight:600">${u.name}</span>
        </div>
      </td>
      <td style="color:var(--text-muted);font-size:0.82rem">${u.email}</td>
      <td><span class="badge ${roleColors[u.role]||'badge-secondary'}">${u.role.charAt(0).toUpperCase()+u.role.slice(1)}</span></td>
      <td style="color:var(--text-muted);font-size:0.82rem">${u.department_name||'—'}</td>
      <td style="color:var(--text-muted);font-size:0.82rem">${u.class||''} ${u.roll_number ? `(${u.roll_number})` : ''}</td>
      <td><span class="badge ${u.is_active?'badge-success':'badge-danger'}">${u.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openUserModal(${u.id})"><i class="ri-edit-line"></i></button>
          <button class="btn btn-danger btn-sm" onclick="openRemoveUserModal(${u.id})"><i class="ri-delete-bin-line"></i> Remove</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterUsers() {
  const search = document.getElementById('userSearch').value.toLowerCase();
  const role = document.getElementById('roleFilter').value;
  renderUsers(allUsers.filter(u =>
    (!search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)) &&
    (!role || u.role === role)
  ));
}

function openUserModal(userId = null) {
  editingUserId = userId;
  document.getElementById('userModalTitle').textContent = userId ? 'Edit User' : 'Add User';
  document.getElementById('userFormError').style.display = 'none';

  if (userId) {
    const u = allUsers.find(x => x.id === userId);
    if (u) {
      document.getElementById('u-name').value = u.name;
      document.getElementById('u-email').value = u.email;
      document.getElementById('u-password').value = '';
      document.getElementById('u-password').placeholder = 'Leave blank to keep current';
      document.getElementById('u-role').value = u.role;
      document.getElementById('u-dept').value = u.department_id || '';
      document.getElementById('u-class').value = u.class || '';
      document.getElementById('u-roll').value = u.roll_number || '';
      document.getElementById('u-year').value = u.year || '';
      document.getElementById('u-phone').value = u.phone || '';
      toggleRoleFields();
    }
  } else {
    document.getElementById('userForm').reset();
    document.getElementById('u-password').placeholder = 'Set initial password';
    toggleRoleFields();
  }
  openModal('userModal');
}

function toggleRoleFields() {
  const role = document.getElementById('u-role').value;
  document.getElementById('f-student').style.display = ['student','advisor'].includes(role) ? '' : 'none';
  document.getElementById('f-year').style.display = role === 'student' ? '' : 'none';
  document.getElementById('f-dept').style.display = ['student','advisor','hod'].includes(role) ? '' : 'none';
}

async function saveUser() {
  const errEl = document.getElementById('userFormError');
  errEl.style.display = 'none';
  const body = {
    name:          document.getElementById('u-name').value.trim(),
    email:         document.getElementById('u-email').value.trim(),
    role:          document.getElementById('u-role').value,
    department_id: document.getElementById('u-dept').value || null,
    class:         document.getElementById('u-class').value.trim() || null,
    roll_number:   document.getElementById('u-roll').value.trim() || null,
    year:          document.getElementById('u-year').value.trim() || null,
    phone:         document.getElementById('u-phone').value.trim() || null,
    is_active:     1,
  };
  const pwd = document.getElementById('u-password').value;
  if (!editingUserId && !pwd) { errEl.textContent = 'Password is required for new users.'; errEl.style.display='block'; return; }
  if (pwd) body.password = pwd;

  try {
    if (editingUserId) {
      await API.put(`/users/${editingUserId}`, body);
      API.showToast('User updated successfully!', 'success');
    } else {
      await API.post('/users', body);
      API.showToast('User created successfully!', 'success');
    }
    closeModal('userModal');
    await loadUsers();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

function openRemoveUserModal(id) {
  const selectedUser = allUsers.find((u) => u.id === id);
  if (!selectedUser) {
    API.showToast('User not found.', 'danger');
    return;
  }

  pendingRemoveUserId = id;
  const msg = document.getElementById('removeUserMessage');
  msg.textContent = `Delete ${selectedUser.name}?`;

  const btn = document.getElementById('confirmRemoveUserBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="ri-delete-bin-line"></i> Delete Permanently';

  openModal('removeUserModal');
}

function closeRemoveUserModal() {
  pendingRemoveUserId = null;
  closeModal('removeUserModal');
}

async function confirmRemoveUser() {
  if (!pendingRemoveUserId) return;
  const selectedUser = allUsers.find((u) => u.id === pendingRemoveUserId);
  const selectedUserName = selectedUser?.name || 'User';

  const btn = document.getElementById('confirmRemoveUserBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Deleting...';

  try {
    await API.delete(`/users/${pendingRemoveUserId}`);
    API.showToast(`${selectedUserName} permanently removed.`, 'info');
    closeRemoveUserModal();
    await loadUsers();
  } catch(e) {
    API.showToast('Error: ' + e.message, 'danger');
    btn.disabled = false;
    btn.innerHTML = '<i class="ri-delete-bin-line"></i> Delete Permanently';
  }
}

// ── All Leaves ────────────────────────────────────────────────────────────────
async function loadLeaves() {
  try {
    allLeaves = await API.get('/leaves');
    renderLeaves(allLeaves);
  } catch(e) {
    document.getElementById('leavesBody').innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger)">${e.message}</td></tr>`;
  }
}

function renderLeaves(leaves) {
  const tbody = document.getElementById('leavesBody');
  if (!leaves.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📋</div><h3>No leave records</h3></div></td></tr>`; return;
  }
  tbody.innerHTML = leaves.map(l => `
    <tr>
      <td><div style="font-weight:600">${l.student_name}</div></td>
      <td style="color:var(--text-muted);font-size:0.8rem">${l.department_name||'—'}</td>
      <td>${API.leaveTypeLabel(l.leave_type)}</td>
      <td>${API.formatDate(l.from_date)}</td>
      <td>${API.formatDate(l.to_date)}</td>
      <td><b>${l.total_days}</b></td>
      <td>${API.statusBadge(l.status)}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${API.formatDate(l.created_at)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewDetail(${l.id})"><i class="ri-eye-line"></i></button></td>
    </tr>`).join('');
}

function filterLeaves() {
  const search = document.getElementById('leaveSearch').value.toLowerCase();
  const status = document.getElementById('leaveStatusFilter').value;
  renderLeaves(allLeaves.filter(l =>
    (!search || l.student_name?.toLowerCase().includes(search) || l.department_name?.toLowerCase().includes(search)) &&
    (!status || l.status === status)
  ));
}

async function viewDetail(id) {
  try {
    const { leave, approvals } = await API.get(`/leaves/${id}`);
    const stages = ['advisor', 'hod', 'principal'];
    const approvalMap = {};
    approvals.forEach(a => { approvalMap[a.role] = a; });

    let timelineHtml = '';
    for (const stage of stages) {
      const a = approvalMap[stage];
      let dotClass = 'waiting', dotIcon = '○';
      if (a) { dotClass = a.action; dotIcon = a.action === 'approved' ? '✓' : '✗'; }
      else if (leave.status === `pending_${stage}`) { dotClass = 'pending'; dotIcon = '⏳'; }
      timelineHtml += `
        <div class="timeline-step">
          <div class="timeline-dot ${dotClass}">${dotIcon}</div>
          <div class="timeline-body">
            <div class="timeline-actor">${stage.charAt(0).toUpperCase()+stage.slice(1)} Review${a ? ` — ${a.approver_name}` : ''}</div>
            ${a ? `<div class="timeline-meta">${API.formatDate(a.actioned_at)}</div>` : `<div class="timeline-meta" style="color:var(--text-muted)">Not yet processed</div>`}
            ${a?.comment ? `<div class="timeline-comment">"${a.comment}"</div>` : ''}
          </div>
        </div>`;
    }
    document.getElementById('detailContent').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Student</div><div style="font-weight:600">${leave.student_name}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Department</div>${leave.department_name||'—'}</div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Type</div>${API.leaveTypeLabel(leave.leave_type)}</div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Status</div>${API.statusBadge(leave.status)}</div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">From</div>${API.formatDate(leave.from_date)}</div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">To (${leave.total_days} days)</div>${API.formatDate(leave.to_date)}</div>
      </div>
      <div style="margin-bottom:20px"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">Reason</div>
      <div style="background:var(--bg-input);border-radius:8px;padding:12px;font-size:0.875rem">${leave.reason}</div></div>
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.07em">Audit Trail</div>
      <div class="timeline">${timelineHtml}</div>`;
    openModal('detailModal');
  } catch(e) { API.showToast('Error: ' + e.message, 'danger'); }
}

// ── CSV Export ────────────────────────────────────────────────────────────────
async function exportCSV() {
  try {
    const token = API.getToken();
    const res = await fetch('/api/analytics/export', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'approveiq_report.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    API.showToast('Report downloaded!', 'success');
  } catch(e) { API.showToast('Export failed: ' + e.message, 'danger'); }
}

// ── Navigation ────────────────────────────────────────────────────────────────
function showSection(name) {
  ['dashboard','users','analytics','leaves'].forEach(s => {
    document.getElementById(`section-${s}`).style.display = s===name?'':'none';
    const n = document.getElementById(`nav-${s}`); if(n) n.classList.toggle('active', s===name);
  });
  if (name === 'analytics') loadAnalytics();
  if (name === 'leaves') loadLeaves();
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
