import { ApiService } from './ApiService.js';
import { AuthTokenStorage } from './AuthTokenStorage.js';

export class LoginService {
  static async login(email: string): Promise<void> {
    const response = await ApiService.post('/api/login', { email });
    const data = (await response.json()) as {
      token?: string;
      token_type?: string;
      expires_in_seconds?: number;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    if (
      typeof data.token === 'string' &&
      data.token_type === 'Bearer' &&
      typeof data.expires_in_seconds === 'number'
    ) {
      AuthTokenStorage.setToken(data.token, data.expires_in_seconds);
      return;
    }

    throw new Error('Login response missing token payload.');
  }
}
