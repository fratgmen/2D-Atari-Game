import { deviceId } from './device.js';

async function request(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : null), ...options.headers };
  const id = deviceId();
  if (id && !headers['x-device-id']) headers['x-device-id'] = id;
  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || 'Sunucuya ulaşılamadı.');
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  return body;
}

export const api = {
  startSession: () => request('/api/sessions', { method: 'POST', body: '{}' }),
  submitScore: (payload) => request('/api/scores', { method: 'POST', body: JSON.stringify(payload) }),
  leaderboard: (limit = 10) => request(`/api/leaderboard?limit=${limit}`),
  config: () => request('/api/config'),
  nicknameTaken: (nickname) => request(`/api/nicknames/${encodeURIComponent(nickname)}/taken`),
  adminList: (token) => request('/api/admin/nicknames', { headers: { 'x-admin-token': token } }),
  adminScores: (token) => request('/api/admin/scores', { headers: { 'x-admin-token': token } }),
  adminDelete: (nickname, token) =>
    request(`/api/admin/nicknames/${encodeURIComponent(nickname)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token },
    }),
};
