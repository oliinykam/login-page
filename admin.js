import { apiFetch, fetchCurrentUser, getAccessToken, logout, showToast } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = getAccessToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // Check RBAC Admin Role
  const currentUser = await fetchCurrentUser();
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  if (currentUser.role !== 'admin') {
    showToast('Access denied: Admin privileges required.');
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 1200);
    return;
  }

  // DOM Elements
  const tabUsersBtn = document.getElementById('tabUsersBtn');
  const tabLogsBtn = document.getElementById('tabLogsBtn');
  const usersPanel = document.getElementById('usersPanel');
  const logsPanel = document.getElementById('logsPanel');
  const usersTableBody = document.getElementById('usersTableBody');
  const logsTableBody = document.getElementById('logsTableBody');
  const refreshUsersBtn = document.getElementById('refreshUsersBtn');
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

  // Tab Navigation
  tabUsersBtn.addEventListener('click', () => {
    tabUsersBtn.classList.add('active');
    tabLogsBtn.classList.remove('active');
    usersPanel.style.display = 'block';
    logsPanel.style.display = 'none';
  });

  tabLogsBtn.addEventListener('click', () => {
    tabLogsBtn.classList.add('active');
    tabUsersBtn.classList.remove('active');
    logsPanel.style.display = 'block';
    usersPanel.style.display = 'none';
    loadLogs();
  });

  refreshUsersBtn.addEventListener('click', () => loadUsers());
  refreshLogsBtn.addEventListener('click', () => loadLogs());
  adminLogoutBtn.addEventListener('click', () => logout());

  // Load Users List
  async function loadUsers() {
    usersTableBody.innerHTML = `<tr><td colspan="6" class="table-loading-cell">Loading users...</td></tr>`;

    try {
      const res = await apiFetch('/api/admin/users');
      if (res.ok) {
        const users = await res.json();
        renderUsers(users);
      } else {
        usersTableBody.innerHTML = `<tr><td colspan="6" class="table-loading-cell text-error">Failed to load users.</td></tr>`;
      }
    } catch (e) {
      usersTableBody.innerHTML = `<tr><td colspan="6" class="table-loading-cell text-error">Server connection error.</td></tr>`;
    }
  }

  function renderUsers(users) {
    if (!users || users.length === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="6" class="table-loading-cell">No users registered yet.</td></tr>`;
      return;
    }

    usersTableBody.innerHTML = users.map(u => {
      const isLocked = u.locked_until && new Date(u.locked_until) > new Date();
      const lockBadge = isLocked
        ? `<span class="badge badge-locked">Locked</span>`
        : `<span class="badge badge-unlocked">Normal</span>`;

      const activeBadge = u.is_active
        ? `<span class="badge badge-active">Active</span>`
        : `<span class="badge badge-inactive">Pending</span>`;

      const roleBadge = u.role === 'admin'
        ? `<span class="badge badge-admin">Admin</span>`
        : `<span class="badge badge-member">User</span>`;

      const btnText = isLocked ? 'Unlock' : 'Lock';
      const btnClass = isLocked ? 'btn-success-sm' : 'btn-danger-sm';

      return `
        <tr>
          <td><strong style="color: var(--text-dark);">#${u.id}</strong></td>
          <td><span class="user-table-email">${escapeHtml(u.email)}</span></td>
          <td>${roleBadge}</td>
          <td>${activeBadge}</td>
          <td>${lockBadge}</td>
          <td style="text-align: right;">
            <button
              type="button"
              class="btn-action ${btnClass}"
              data-user-id="${u.id}"
              data-locked="${isLocked}"
            >
              ${btnText}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Toggle Lock Handlers
    usersTableBody.querySelectorAll('.btn-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-user-id');
        btn.disabled = true;
        try {
          const res = await apiFetch(`/api/admin/users/${userId}/toggle-lock`, { method: 'POST' });
          if (res.ok) {
            showToast('User status updated successfully.');
            await loadUsers();
          } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.detail || 'Could not update user status.');
            btn.disabled = false;
          }
        } catch (err) {
          showToast('Failed to toggle lock.');
          btn.disabled = false;
        }
      });
    });
  }

  // Load Audit Logs List
  async function loadLogs() {
    logsTableBody.innerHTML = `<tr><td colspan="5" class="table-loading-cell">Loading audit logs...</td></tr>`;

    try {
      const res = await apiFetch('/api/admin/logs');
      if (res.ok) {
        const logs = await res.json();
        renderLogs(logs);
      } else {
        logsTableBody.innerHTML = `<tr><td colspan="5" class="table-loading-cell text-error">Failed to load audit logs.</td></tr>`;
      }
    } catch (e) {
      logsTableBody.innerHTML = `<tr><td colspan="5" class="table-loading-cell text-error">Server connection error.</td></tr>`;
    }
  }

  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      logsTableBody.innerHTML = `<tr><td colspan="5" class="table-loading-cell">No audit logs recorded yet.</td></tr>`;
      return;
    }

    logsTableBody.innerHTML = logs.map(log => {
      let statusBadge = '';
      const statusLower = (log.status || '').toLowerCase();
      if (statusLower === 'success') {
        statusBadge = `<span class="badge badge-active">SUCCESS</span>`;
      } else if (statusLower === 'locked') {
        statusBadge = `<span class="badge badge-locked">LOCKED</span>`;
      } else {
        statusBadge = `<span class="badge badge-inactive">FAILED</span>`;
      }

      const formattedTime = log.timestamp
        ? new Date(log.timestamp).toLocaleString()
        : '—';

      return `
        <tr>
          <td><span class="log-time">${formattedTime}</span></td>
          <td><span class="user-table-email">${escapeHtml(log.attempted_email || '—')}</span></td>
          <td><code>${escapeHtml(log.ip_address || '—')}</code></td>
          <td><span class="user-agent-cell" title="${escapeHtml(log.user_agent || '')}">${escapeHtml(log.user_agent ? log.user_agent.slice(0, 45) + '...' : '—')}</span></td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load
  await loadUsers();
});
