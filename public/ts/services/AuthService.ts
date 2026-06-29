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
      activated?: boolean;
    };
    return new User(
      data.id,
      data.email,
      data.nickname,
      data.activated ?? false,
    );
  }

  static async logout(): Promise<void> {
    try {
      await ApiService.post('/api/logout');
    } finally {
      AuthTokenStorage.clearToken();
      this.redirectToLogin();
    }
  }

  static async renew(): Promise<boolean> {
    try {
      const response = await ApiService.post('/api/renew');
      if (response.status === 401) {
        AuthTokenStorage.clearToken();
        this.redirectToLogin();
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

  static isAuthenticated(): boolean {
    return this.hasToken() && !this.isTokenExpired();
  }

  static redirectToLogin(): void {
    if (typeof window.location.replace === 'function') {
      window.location.replace('/login');
      return;
    }
    window.location.href = '/login';
  }

  static redirectToLoginWhenUnauthenticated(): boolean {
    if (this.isAuthenticated()) {
      return false;
    }
    document.documentElement.classList.add('auth-redirecting');
    this.redirectToLogin();
    return true;
  }

  static isTokenRenewalDue(refreshBeforeMs: number): boolean {
    return AuthTokenStorage.isRenewalDue(refreshBeforeMs);
  }

  static isTokenExpired(): boolean {
    return AuthTokenStorage.isExpired();
  }
}
