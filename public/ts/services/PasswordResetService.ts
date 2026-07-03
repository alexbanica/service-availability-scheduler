import { ApiService } from './ApiService.js';

export class PasswordResetService {
  static async requestPasswordReset(
    email: string,
    recaptchaToken: string,
  ): Promise<void> {
    const response = await ApiService.post('/api/password-reset/request', {
      email,
      recaptcha_token: recaptchaToken,
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || 'Reset request failed.');
    }
  }

  static async validateToken(token: string): Promise<boolean> {
    const response = await ApiService.post('/api/password-reset/validate', {
      token,
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || 'Invalid reset token.');
    }

    return Boolean(data.ok);
  }

  static async resetPassword(
    token: string,
    password: string,
    confirmPassword: string,
  ): Promise<void> {
    const response = await ApiService.post('/api/password-reset', {
      token,
      password,
      confirm_password: confirmPassword,
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Password reset failed.');
    }
  }
}
