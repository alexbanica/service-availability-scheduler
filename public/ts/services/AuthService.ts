import { ApiService } from './ApiService.js';
import { AuthTokenStorage } from './AuthTokenStorage.js';
import { User } from '../entities/User.js';

export class AuthService {
  static async loadUser(): Promise<User | null> {
    const response = await ApiService.get('/api/me');
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      id: string;
      email: string;
      nickname: string;
    };
    return new User(data.id, data.email, data.nickname);
  }

  static async logout(): Promise<void> {
    await ApiService.post('/api/logout');
    AuthTokenStorage.clearToken();
    window.location.href = '/login';
  }

  static async renew(): Promise<boolean> {
    try {
      const response = await ApiService.post('/api/renew');
      if (response.status === 401) {
        AuthTokenStorage.clearToken();
        window.location.href = '/login';
        return false;
      }

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        token?: string;
        token_type?: string;
        expires_in_seconds?: number;
      };
      if (
        typeof data.token === 'string' &&
        data.token_type === 'Bearer' &&
        typeof data.expires_in_seconds === 'number'
      ) {
        AuthTokenStorage.setToken(data.token, data.expires_in_seconds);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  static hasToken(): boolean {
    return AuthTokenStorage.hasStoredToken();
  }

  static isTokenRenewalDue(refreshBeforeMs: number): boolean {
    return AuthTokenStorage.isRenewalDue(refreshBeforeMs);
  }

  static isTokenExpired(): boolean {
    return AuthTokenStorage.isExpired();
  }
}
