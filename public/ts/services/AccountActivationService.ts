import { ApiService } from './ApiService.js';
import { AuthTokenStorage } from './AuthTokenStorage.js';

export class AccountActivationService {
  static async validate(token: { token: string }): Promise<boolean> {
    const response = await ApiService.post(
      '/api/account-activation/validate',
      token,
    );
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || 'Invalid activation token.');
    }

    return Boolean(data.ok);
  }

  static async activate(token: { token: string }): Promise<void> {
    const response = await ApiService.post('/api/account-activation', token);
    const data = (await response.json()) as {
      ok?: boolean;
      token?: string;
      token_type?: string;
      expires_in_seconds?: number;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Activation failed.');
    }

    if (
      typeof data.token === 'string' &&
      data.token_type === 'Bearer' &&
      typeof data.expires_in_seconds === 'number'
    ) {
      AuthTokenStorage.setToken(data.token, data.expires_in_seconds);
      return;
    }

    throw new Error('Activation response missing token payload.');
  }
}
