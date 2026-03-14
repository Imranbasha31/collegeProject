// ── Principal Dashboard JS ────────────────────────────────────────────────────
let user = null;
let allLeaves = [];
let allNotifs = [];
let currentLeaveId = null;

document.addEventListener('DOMContentLoaded', async () => {
  user = API.requireAuth(['principal']);
  if (!user) return;
  document.getElementById('userName').textContent = user.name;
  document.getElementById('avatarInitial').textContent = user.name[0].toUpperCase();
  await Promise.all([loadLeaves(), loadNotifications()]);
});

async function loadLeaves() {
  try {
    allLeaves = await API.get('/leaves');
    const pending = allLeaves.filter(l => l.status === 'pending_principal');
    renderPending(pending);
    renderAll(allLeaves);
    updateKPIs(allLeaves);
  } catch(e) {
    document.getElementById('pendingBody').innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger)">${e.message}</td></tr>`;
  }
}

function updateKPIs(leaves) {
  document.getElementById('kpi-total').textContent = leaves.length;
  const pending = leaves.filter(l => l.status === 'pending_principal').length;
  document.getElementById('kpi-pending').textContent = pending;
  document.getElementById('kpi-approved').textContent = leaves.filter(l => l.status === 'approved').length;
  document.getElementById('kpi-rejected').textContent = leaves.filter(l => l.status === 'rejected').length;
  const el = document.getElementById('pendingCount');
  el.textContent = pending; el.style.display = pending > 0 ? '' : 'none';
}

function renderPending(leaves) {
  const tbody = document.getElementById('pendingBody');
  if (!leaves.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">✅</div><h3>No pending final approvals</h3><p>All requests have been processed</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = leaves.map(l => `
    <tr>
      <td><div style="font-weight:600">${l.student_name}</div><div style="font-size:0.75rem;color:var(--text-muted)">${l.roll_number||'—'}</div></td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${l.department_name||'—'}</td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${l.class||'—'}</td>
      <td>${API.leaveTypeLabel(l.leave_type)}</td>
      <td>${API.formatDate(l.from_date)}</td>
      <td>${API.formatDate(l.to_date)}</td>
      <td><b>${l.total_days}</b></td>
      <td>${API.formatDate(l.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openAction(${l.id})"><i class="ri-auction-line"></i> Decide</button>
          <button class="btn btn-ghost btn-sm" onclick="viewDetail(${l.id})"><i class="ri-eye-line"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAll(leaves) {
  const tbody = document.getElementById('allBody');
  if (!leaves.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div><h3>No records</h3></div></td></tr>`; return;
  }
  tbody.innerHTML = leaves.map(l => `
    <tr>
      <td><div style="font-weight:600">${l.student_name}</div></td>
      <td style="font-size:0.8rem;color:var(--text-muted)">${l.department_name||'—'}</td>
      <td>${API.leaveTypeLabel(l.leave_type)}</td>
      <td>${API.formatDate(l.from_date)}</td>
      <td>${API.formatDate(l.to_date)}</td>
      <td><b>${l.total_days}</b></td>
      <td>${API.statusBadge(l.status)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewDetail(${l.id})"><i class="ri-eye-line"></i> View</button></td>
    </tr>`).join('');
}

function filterAll() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  renderAll(allLeaves.filter(l =>
    (!search || l.student_name?.toLowerCase().includes(search) || l.department_name?.toLowerCase().includes(search)) &&
    (!status || l.status === status)
  ));
}

async function openAction(leaveId) {
  currentLeaveId = leaveId;
  try {
    const { leave, approvals } = await API.get(`/leaves/${leaveId}`);
    const advisorApproval = approvals.find(a => a.role === 'advisor');
    const hodApproval = approvals.find(a => a.role === 'hod');
    document.getElementById('actionModalContent').innerHTML = `
      <div style="background:var(--bg-input);border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.85rem">
          <div><b>Student:</b> ${leave.student_name}</div>
          <div><b>Department:</b> ${leave.department_name||'—'}</div>
          <div><b>Leave Type:</b> ${API.leaveTypeLabel(leave.leave_type)}</div>
          <div><b>Duration:</b> ${API.formatDate(leave.from_date)} – ${API.formatDate(leave.to_date)} (${leave.total_days} days)</div>
        </div>
        <div style="margin-top:10px;font-size:0.85rem"><b>Reason:</b> ${leave.reason}</div>
        ${leave.document_path ? `<div style="margin-top:8px"><a href="${leave.document_path}" target="_blank" class="btn btn-ghost btn-sm"><i class="ri-attachment-2"></i> View Document</a></div>` : ''}
      </div>
      <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:12px;margin-bottom:16px;font-size:0.82rem">
        <div style="color:var(--success);font-weight:600;margin-bottom:6px">✓ Approved by Advisor & HOD</div>
        ${advisorApproval ? `<div>Advisor (${advisorApproval.approver_name}): "${advisorApproval.comment||'—'}"</div>` : ''}
        ${hodApproval ? `<div style="margin-top:4px">HOD (${hodApproval.approver_name}): "${hodApproval.comment||'—'}"</div>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Principal's Remarks (optional)</label>
        <textarea class="form-control" id="actionComment" rows="3" placeholder="Add your final decision remarks..."></textarea>
      </div>`;
    openModal('actionModal');
  } catch(e) { API.showToast('Error: ' + e.message, 'danger'); }
}

async function submitAction(action) {
  const comment = document.getElementById('actionComment')?.value || '';
  try {
    const endpoint = action === 'approved' ? `/leaves/${currentLeaveId}/approve` : `/leaves/${currentLeaveId}/reject`;
    await API.patch(endpoint, { comment });
    closeModal('actionModal');
    API.showToast(action === 'approved' ? 'Leave fully approved! Student has been notified.' : 'Leave rejected.', action === 'approved' ? 'success' : 'danger');
    await loadLeaves();
  } catch(e) { API.showToast('Error: ' + e.message, 'danger'); }
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
            ${a ? `<div class="timeline-meta">${API.formatDate(a.actioned_at)}</div>` : `<div class="timeline-meta" style="color:var(--text-muted)">${dotClass==='pending'?'Currently pending':'Awaiting'}</div>`}
            ${a?.comment ? `<div class="timeline-comment">"${a.comment}"</div>` : ''}
          </div>
        </div>`;
    }

    document.getElementById('detailContent').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Student</div><div style="font-weight:600">${leave.student_name}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Department</div><div>${leave.department_name||'—'}</div></div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Type</div>${API.leaveTypeLabel(leave.leave_type)}</div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">Status</div>${API.statusBadge(leave.status)}</div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">From</div>${API.formatDate(leave.from_date)}</div>
        <div><div style="font-size:0.72rem;color:var(--text-muted)">To (${leave.total_days} days)</div>${API.formatDate(leave.to_date)}</div>
      </div>
      <div style="margin-bottom:20px"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">Reason</div>
      <div style="background:var(--bg-input);border-radius:8px;padding:12px;font-size:0.875rem">${leave.reason}</div></div>
      ${leave.document_path ? `<div style="margin-bottom:20px"><a href="${leave.document_path}" target="_blank" class="btn btn-ghost btn-sm"><i class="ri-attachment-2"></i> View Document</a></div>` : ''}
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.07em">Complete Audit Trail</div>
      <div class="timeline">${timelineHtml}</div>`;
    openModal('detailModal');
  } catch(e) { API.showToast('Error: ' + e.message, 'danger'); }
}

async function loadNotifications() {
  try {
    allNotifs = await API.get('/notifications');
    const unread = allNotifs.filter(n => !n.is_read).length;
    const el = document.getElementById('notifCount');
    el.textContent = unread; el.style.display = unread > 0 ? '' : 'none';
    renderNotifs();
  } catch(e) {}
}
function renderNotifs() {
  const el = document.getElementById('notifList');
  if (!allNotifs.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><h3>No notifications</h3></div>`; return; }
  el.innerHTML = allNotifs.map(n => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)">
      <div style="width:8px;height:8px;border-radius:50%;background:${n.is_read?'var(--text-muted)':'var(--purple)'};margin-top:6px;flex-shrink:0"></div>
      <div style="flex:1"><div style="font-size:0.875rem;${n.is_read?'color:var(--text-secondary)':'font-weight:500'}">${n.message}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${API.formatDate(n.created_at)}</div></div>
      ${!n.is_read ? `<button class="btn btn-ghost btn-sm" onclick="markRead(${n.id})">Read</button>` : ''}
    </div>`).join('');
}
async function markRead(id) { await API.patch(`/notifications/${id}/read`); await loadNotifications(); }
async function markAllRead() { await API.patch('/notifications/read-all'); await loadNotifications(); }

function showSection(name) {
  ['pending','all','notifications'].forEach(s => {
    document.getElementById(`section-${s}`).style.display = s===name?'':'none';
    const n = document.getElementById(`nav-${s}`); if(n) n.classList.toggle('active', s===name);
  });
  if (name === 'notifications') loadNotifications();
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
