
const API = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('poker_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
};

export const api = {
  signup: (data) => fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
  login: (data) => fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),
  getMe: () => fetch(`${API}/auth/me`, { headers: getHeaders() }).then(handleResponse),

  createRoom: (data) => fetch(`${API}/rooms`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  getRoom: (hash) => fetch(`${API}/rooms/${hash}`).then(handleResponse),
  updateRoom: (hash, params) => fetch(`${API}/rooms/${hash}?${new URLSearchParams(params)}`, { method: 'PATCH', headers: getHeaders() }).then(handleResponse),

  createStory: (hash, data) => fetch(`${API}/rooms/${hash}/stories`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  bulkCreateStories: (hash, stories) => fetch(`${API}/rooms/${hash}/stories/bulk`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(stories) }).then(handleResponse),
  updateStory: (id, data) => fetch(`${API}/stories/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse),
  deleteStory: (id) => fetch(`${API}/stories/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),

  submitVote: (storyId, data) => fetch(`${API}/stories/${storyId}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse),

  getExportUrl: (hash) => `${API}/rooms/${hash}/export`,
  getRooms: () => fetch(`${API}/rooms`, { headers: getHeaders() }).then(handleResponse),
  deleteRoom: (hash) => fetch(`${API}/rooms/${hash}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),

};
