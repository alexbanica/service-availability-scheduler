import { ApiService } from './ApiService.js';

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
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Activation failed.');
    }
  }
}
