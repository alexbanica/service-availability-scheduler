import { URLSearchParams } from 'node:url';

export type RecaptchaAction = 'password_reset_request' | 'register';

export type RecaptchaVerificationResult =
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export type RecaptchaSiteVerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  'error-codes'?: string[];
};

type FetchLike = (
  input: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export class CaptchaService {
  private readonly siteVerifyUrl =
    'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private readonly fetchImpl: FetchLike = globalThis.fetch.bind(
      globalThis,
    ) as FetchLike,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  isRecaptchaEnabled(): boolean {
    return Boolean(this.getSiteKey());
  }

  getSiteKey(): string {
    return String(this.env.GOOGLE_RECAPTCHA_SITE_KEY || '').trim();
  }

  async verifyRecaptchaToken(
    token: string,
    expectedAction: RecaptchaAction,
  ): Promise<RecaptchaVerificationResult> {
    const secretKey = this.getSecretKey();
    if (!this.getSiteKey() || !secretKey) {
      return { status: 'unavailable' };
    }

    try {
      const body = new URLSearchParams({
        secret: secretKey,
        response: token,
      }).toString();
      const response = await this.fetchImpl(this.siteVerifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        return { status: 'invalid' };
      }

      const payload = (await response.json()) as RecaptchaSiteVerifyResponse;
      if (
        payload.success !== true ||
        payload.action !== expectedAction ||
        typeof payload.score !== 'number' ||
        payload.score < this.getMinimumScore()
      ) {
        return { status: 'invalid' };
      }

      return { status: 'valid' };
    } catch {
      return { status: 'invalid' };
    }
  }

  private getSecretKey(): string {
    return String(this.env.GOOGLE_RECAPTCHA_SECRET_KEY || '').trim();
  }

  private getMinimumScore(): number {
    const configured = Number(this.env.GOOGLE_RECAPTCHA_MIN_SCORE);
    if (Number.isFinite(configured)) {
      return configured;
    }
    return 0.5;
  }
}
