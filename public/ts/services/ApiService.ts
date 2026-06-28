import { AuthTokenStorage } from './AuthTokenStorage.js';

export type RequestMethod = 'GET' | 'POST' | 'DELETE' | 'PATCH';

export class ApiService {
  static async get(path: string): Promise<Response> {
    return this.request('GET', path);
  }

  static async post(
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<Response> {
    return this.request('POST', path, payload);
  }

  static async patch(
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<Response> {
    return this.request('PATCH', path, payload);
  }

  static async delete(path: string): Promise<Response> {
    return this.request('DELETE', path);
  }

  private static async request(
    method: RequestMethod,
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = AuthTokenStorage.getToken();
    if (token && path !== '/api/login') {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      method,
      headers,
      body:
        method === 'POST' || method === 'PATCH'
          ? JSON.stringify(payload || {})
          : undefined,
    });

    if (response.status === 401 && path !== '/api/login') {
      AuthTokenStorage.clearToken();
      window.location.href = '/login';
      return response;
    }

    return response;
  }
}
