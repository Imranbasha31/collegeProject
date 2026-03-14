// ── Student Dashboard JS ──────────────────────────────────────────────────────
let user = null;
let allLeaves = [];

document.addEventListener('DOMContentLoaded', async () => {
  user = API.requireAuth(['student']);
  if (!user) return;

  document.getElementById('userName').textContent = user.name;
  document.getElementById('avatarInitial').textContent = user.name[0].toUpperCase();
  document.getElementById('studentInfo').textContent =
    `${user.roll_number || ''} · ${user.class || ''} · ${user.department_name || ''}`.replace(/^ · | · $/g, '');

  // Set min date for from/to
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fromDate').min = today;
  document.getElementById('toDate').min = today;
  document.getElementById('fromDate').addEventListener('change', () => {
    document.getElementById('toDate').min = document.getElementById('fromDate').value;
  });

  await Promise.all([loadLeaves(), loadNotifications()]);
});

async function loadLeaves() {
  try {
    allLeaves = await API.get('/leaves');
    renderLeaves(allLeaves);
    updateKPIs(allLeaves);
  } catch (e) {
    document.getElementById('leavesBody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger)">Failed to load leaves: ${e.message}</td></tr>`;
  }
}

function updateKPIs(leaves) {
  document.getElementById('kpi-total').textContent = leaves.length;
  document.getElementById('kpi-pending').textContent = leaves.filter(l => l.status.startsWith('pending')).length;
  document.getElementById('kpi-approved').textContent = leaves.filter(l => l.status === 'approved').length;
  document.getElementById('kpi-rejected').textContent = leaves.filter(l => l.status === 'rejected').length;
}

function renderLeaves(leaves) {
  const tbody = document.getElementById('leavesBody');
  if (!leaves.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div><h3>No leave requests yet</h3><p>Apply for your first leave using the button above</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = leaves.map(l => `
    <tr>
      <td>${l.id}</td>
      <td>${API.leaveTypeLabel(l.leave_type)}</td>
      <td>${API.formatDate(l.from_date)}</td>
      <td>${API.formatDate(l.to_date)}</td>
      <td><b>${l.total_days}</b></td>
      <td>${API.statusBadge(l.status)}</td>
      <td>${API.formatDate(l.created_at)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="viewDetail(${l.id})">
          <i class="ri-eye-line"></i> View
        </button>
      </td>
    </tr>
  `).join('');
}

function filterLeaves() {
  const status = document.getElementById('filterStatus').value;
  const filtered = status ? allLeaves.filter(l => l.status === status) : allLeaves;
  renderLeaves(filtered);
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
            <div class="timeline-actor">${stage.charAt(0).toUpperCase() + stage.slice(1)} Review${a ? ` — ${a.approver_name}` : ''}</div>
            ${a ? `<div class="timeline-meta">${API.formatDate(a.actioned_at)}</div>` : `<div class="timeline-meta" style="color:var(--text-muted)">${dotClass === 'pending' ? 'Currently under review' : 'Awaiting previous stage'}</div>`}
            ${a?.comment ? `<div class="timeline-comment">"${a.comment}"</div>` : ''}
          </div>
        </div>`;
    }

    document.getElementById('detailContent').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
        <div><div style="font-size:0.75rem;color:var(--text-muted)">Type</div><div style="font-weight:600">${API.leaveTypeLabel(leave.leave_type)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-muted)">Status</div>${API.statusBadge(leave.status)}</div>
        <div><div style="font-size:0.75rem;color:var(--text-muted)">From</div><div style="font-weight:600">${API.formatDate(leave.from_date)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-muted)">To</div><div style="font-weight:600">${API.formatDate(leave.to_date)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-muted)">Total Days</div><div style="font-weight:600">${leave.total_days}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-muted)">Submitted</div><div style="font-weight:600">${API.formatDate(leave.created_at)}</div></div>
      </div>
      <div style="margin-bottom:24px">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">Reason</div>
        <div style="font-size:0.875rem;background:var(--bg-input);border-radius:8px;padding:12px;">${leave.reason}</div>
      </div>
      ${leave.document_path ? `<div style="margin-bottom:24px"><a href="${leave.document_path}" target="_blank" class="btn btn-ghost btn-sm"><i class="ri-attachment-2"></i> View Document</a></div>` : ''}
      <div style="font-size:0.8rem;font-weight:700;color:var(--text-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.07em;">Approval Trail</div>
      <div class="timeline">${timelineHtml}</div>`;

    openModal('detailModal');
  } catch(e) {
    API.showToast('Failed to load details: ' + e.message, 'danger');
  }
}

// ── Apply Leave ───────────────────────────────────────────────────────────────
document.getElementById('leaveForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('applyError');
  errEl.style.display = 'none';
  try {
    const data = await API.post('/leaves', {
      leave_type: document.getElementById('leaveType').value,
      from_date:  document.getElementById('fromDate').value,
      to_date:    document.getElementById('toDate').value,
      reason:     document.getElementById('reason').value,
    });

    // Upload document if selected
    const fileInput = document.getElementById('docFile');
    if (fileInput.files[0]) {
      const fd = new FormData();
      fd.append('document', fileInput.files[0]);
      await API.upload(`/leaves/${data.leaveId}/document`, fd);
    }

    API.showToast('Leave request submitted successfully!', 'success');
    document.getElementById('leaveForm').reset();
    await loadLeaves();
    showSection('leaves');
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────
let allNotifs = [];
async function loadNotifications() {
  try {
    allNotifs = await API.get('/notifications');
    const unread = allNotifs.filter(n => !n.is_read).length;
    const countEl = document.getElementById('notifCount');
    if (unread > 0) { countEl.textContent = unread; countEl.style.display = ''; }
    renderNotifs();
  } catch(e) {}
}

function renderNotifs() {
  const el = document.getElementById('notifList');
  if (!allNotifs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><h3>No notifications</h3><p>You're all caught up!</p></div>`;
    return;
  }
  el.innerHTML = allNotifs.map(n => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-bottom:1px solid var(--border);${!n.is_read ? 'background:rgba(99,126,255,0.03);border-radius:8px;padding:14px;margin:-2px;' : ''}">
      <div style="width:8px;height:8px;border-radius:50%;background:${n.is_read ? 'var(--text-muted)' : 'var(--primary)'};margin-top:6px;flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:0.875rem;${n.is_read ? 'color:var(--text-secondary)' : 'font-weight:500'}">${n.message}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${API.formatDate(n.created_at)}</div>
      </div>
      ${!n.is_read ? `<button class="btn btn-ghost btn-sm" onclick="markRead(${n.id})">Mark read</button>` : ''}
    </div>`).join('');
}

async function markRead(id) {
  await API.patch(`/notifications/${id}/read`);
  await loadNotifications();
}

async function markAllRead() {
  await API.patch('/notifications/read-all');
  await loadNotifications();
}

// ── Navigation ────────────────────────────────────────────────────────────────
function showSection(name) {
  ['leaves', 'apply', 'notifications'].forEach(s => {
    document.getElementById(`section-${s}`).style.display = s === name ? '' : 'none';
    const navEl = document.getElementById(`nav-${s}`);
    if (navEl) navEl.classList.toggle('active', s === name);
  });
  if (name === 'notifications') loadNotifications();
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
