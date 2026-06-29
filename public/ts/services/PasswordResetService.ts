import { ApiService } from './ApiService.js';

export type PasswordResetChallenge = {
  challengeId: string;
  challengePrompt: string;
};

export class PasswordResetService {
  static async requestChallenge(): Promise<PasswordResetChallenge> {
    const response = await ApiService.post('/api/password-reset/captcha');
    const data = (await response.json()) as {
      challenge_id?: string;
      challenge_prompt?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create captcha challenge.');
    }

    return {
      challengeId: String(data.challenge_id || ''),
      challengePrompt: String(data.challenge_prompt || ''),
    };
  }

  static async requestPasswordReset(
    email: string,
    challengeId: string,
    challengeAnswer: string,
  ): Promise<void> {
    const response = await ApiService.post('/api/password-reset/request', {
      email,
      challenge_id: challengeId,
      challenge_answer: challengeAnswer,
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
