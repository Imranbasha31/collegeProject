const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('approveiq_token');
}

async function request(endpoint) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, { headers });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export async function loadDashboardData() {
  try {
    const [summary, trends, leaves] = await Promise.all([
      request('/analytics/summary'),
      request('/analytics/trends'),
      request('/leaves'),
    ]);

    if (!summary || !trends || !leaves) {
      return null;
    }

    return { summary, trends, leaves };
  } catch (_) {
    return null;
  }
}
