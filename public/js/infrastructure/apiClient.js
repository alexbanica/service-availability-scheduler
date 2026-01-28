export async function apiGet(path) {
  return fetch(path, { credentials: 'include' });
}

export async function apiPost(path, payload) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload || {})
  });
}
