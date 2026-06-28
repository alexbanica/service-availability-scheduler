export class AuthTokenStorage {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly TOKEN_EXPIRES_AT_MS_KEY = 'auth_token_expires_at_ms';

  static getToken(): string | null {
    try {
      return localStorage.getItem(AuthTokenStorage.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static setToken(token: string, expiresInSeconds: number): void {
    try {
      const expiresAtMs = Date.now() + expiresInSeconds * 1000;
      localStorage.setItem(AuthTokenStorage.TOKEN_KEY, token);
      localStorage.setItem(
        AuthTokenStorage.TOKEN_EXPIRES_AT_MS_KEY,
        String(expiresAtMs),
      );
    } catch {
      return;
    }
  }

  static clearToken(): void {
    try {
      localStorage.removeItem(AuthTokenStorage.TOKEN_KEY);
      localStorage.removeItem(AuthTokenStorage.TOKEN_EXPIRES_AT_MS_KEY);
    } catch {
      return;
    }
  }

  static getExpiryEpochMs(): number | null {
    try {
      const stored = localStorage.getItem(AuthTokenStorage.TOKEN_EXPIRES_AT_MS_KEY);
      if (!stored) {
        return null;
      }
      const value = Number(stored);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  static hasStoredToken(): boolean {
    return !!AuthTokenStorage.getToken();
  }

  static isExpired(): boolean {
    const expiry = this.getExpiryEpochMs();
    if (expiry === null) {
      return false;
    }
    return expiry <= Date.now();
  }

  static isRenewalDue(refreshBeforeMs: number): boolean {
    const expiry = this.getExpiryEpochMs();
    if (expiry === null) {
      return false;
    }
    return expiry - Date.now() <= refreshBeforeMs;
  }
}
