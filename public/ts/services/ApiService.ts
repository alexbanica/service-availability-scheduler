export class ApiService {
  static async get(path: string): Promise<Response> {
    return fetch(path, { credentials: 'include' });
  }

  static async post(
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<Response> {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload || {}),
    });
  }

  static async delete(path: string): Promise<Response> {
    return fetch(path, {
      method: 'DELETE',
      credentials: 'include',
    });
  }
}
