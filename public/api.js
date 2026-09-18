async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
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
  adminList: (token) => request('/api/admin/nicknames', { headers: { 'x-admin-token': token } }),
  adminDelete: (nickname, token) =>
    request(`/api/admin/nicknames/${encodeURIComponent(nickname)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token },
    }),
};
