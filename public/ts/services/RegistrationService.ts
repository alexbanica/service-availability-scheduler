import { ApiService } from './ApiService.js';
import { AuthTokenStorage } from './AuthTokenStorage.js';

export class RegistrationService {
  static async register(payload: {
    email: string;
    nickname: string;
    password: string;
    confirm_password: string;
    recaptcha_token: string;
    invitation_code?: string;
  }): Promise<void> {
    const response = await ApiService.post('/api/register', payload);
    const data = (await response.json()) as {
      ok?: boolean;
      token?: string;
      token_type?: string;
      expires_in_seconds?: number;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Registration failed.');
    }

    if (
      typeof data.token === 'string' &&
      data.token_type === 'Bearer' &&
      typeof data.expires_in_seconds === 'number'
    ) {
      AuthTokenStorage.setToken(data.token, data.expires_in_seconds);
      return;
    }

    throw new Error('Registration response missing token payload.');
  }
}
