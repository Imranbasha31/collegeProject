// ApprovIQ - Central API Helper
// Attaches JWT token to all requests and handles 401 redirects

const API = {
  BASE: '/api',
  THEME_KEY: 'approveiq_theme',

  getToken() {
    return localStorage.getItem('approveiq_token');
  },

  getUser() {
    const u = localStorage.getItem('approveiq_user');
    return u ? JSON.parse(u) : null;
  },

  setSession(token, user) {
    localStorage.setItem('approveiq_token', token);
    localStorage.setItem('approveiq_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('approveiq_token');
    localStorage.removeItem('approveiq_user');
  },

  async request(method, endpoint, body = null, isFormData = false) {
    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const options = { method, headers };
    if (body) options.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(this.BASE + endpoint, options);

    if (res.status === 401) {
      this.clearSession();
      window.location.href = '/';
      return;
    }
    if (res.headers.get('content-type')?.includes('text/csv')) {
      return res;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(endpoint)          { return this.request('GET', endpoint); },
  post(endpoint, body)   { return this.request('POST', endpoint, body); },
  patch(endpoint, body)  { return this.request('PATCH', endpoint, body); },
  put(endpoint, body)    { return this.request('PUT', endpoint, body); },
  delete(endpoint)       { return this.request('DELETE', endpoint); },
  upload(endpoint, fd)   { return this.request('POST', endpoint, fd, true); },

  logout() {
    this.clearSession();
    window.location.href = '/';
  },

  requireAuth(allowedRoles = []) {
    const user = this.getUser();
    const token = this.getToken();
    if (!token || !user) { window.location.href = '/'; return null; }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      window.location.href = '/';
      return null;
    }
    return user;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  statusBadge(status) {
    const map = {
      pending_advisor:   ['Pending Advisor',   'badge-warning'],
      pending_hod:       ['Pending HOD',        'badge-info'],
      pending_principal: ['Pending Principal',  'badge-purple'],
      approved:          ['Approved',            'badge-success'],
      rejected:          ['Rejected',            'badge-danger'],
    };
    const [label, cls] = map[status] || [status, 'badge-secondary'];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  leaveTypeLabel(type) {
    const map = { medical: '🏥 Medical', personal: '👤 Personal', family: '👨‍👩‍👦 Family', academic: '📚 Academic', other: '📋 Other' };
    return map[type] || type;
  },

  getThemePreference() {
    const storedTheme = localStorage.getItem(this.THEME_KEY);
    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  applyTheme(theme) {
    const selectedTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', selectedTheme);
    document.documentElement.style.colorScheme = selectedTheme;
    this.updateThemeToggleIcon(selectedTheme);
  },

  updateThemeToggleIcon(theme = this.getThemePreference()) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    const isDark = theme === 'dark';
    btn.innerHTML = isDark ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.setAttribute('aria-label', btn.title);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || this.getThemePreference();
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(this.THEME_KEY, nextTheme);
    this.applyTheme(nextTheme);
  },

  ensureThemeToggleButton() {
    if (document.getElementById('themeToggleBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'themeToggleBtn';
    btn.className = 'theme-toggle-btn';
    btn.addEventListener('click', () => this.toggleTheme());
    document.body.appendChild(btn);
    this.updateThemeToggleIcon();
  },

  initThemeToggle() {
    this.applyTheme(this.getThemePreference());
    this.ensureThemeToggleButton();

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', (event) => {
        const savedTheme = localStorage.getItem(this.THEME_KEY);
        if (!savedTheme) this.applyTheme(event.matches ? 'dark' : 'light');
      });
    }
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container') || (() => {
      const c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 4000);
  },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => API.initThemeToggle());
} else {
  API.initThemeToggle();
}
