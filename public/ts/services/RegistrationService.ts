import { ApiService } from './ApiService.js';

export type RegistrationChallenge = {
  challengeId: string;
  challengePrompt: string;
};

export class RegistrationService {
  static async requestChallenge(): Promise<RegistrationChallenge> {
    const response = await ApiService.post('/api/register/captcha');
    const data = (await response.json()) as {
      challenge_id?: string;
      challenge_prompt?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create registration challenge.');
    }

    return {
      challengeId: String(data.challenge_id || ''),
      challengePrompt: String(data.challenge_prompt || ''),
    };
  }

  static async register(payload: {
    email: string;
    nickname: string;
    password: string;
    confirm_password: string;
    challenge_id: string;
    challenge_answer: string;
  }): Promise<void> {
    const response = await ApiService.post('/api/register', payload);
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Registration failed.');
    }
  }
}
