import { randomBytes, randomInt } from 'node:crypto';

export type CaptchaChallenge = {
  id: string;
  prompt: string;
  answer: string;
  expiresAt: Date;
};

type Logger = {
  debug: (message: string, ...params: Array<unknown>) => void;
};

type ChallengeStore = Map<string, CaptchaChallenge>;

export class CaptchaService {
  private readonly store: ChallengeStore = new Map();
  private readonly challengeTtlMs = 5 * 60 * 1000;

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly logger: Logger = console,
  ) {}

  async createChallenge(): Promise<{ challengeId: string; prompt: string }> {
    this.purgeExpiredChallenges();

    const left = randomInt(10, 99);
    const right = randomInt(10, 99);
    const answer = `${left + right}`;
    const id = randomBytes(16).toString('hex');

    const challenge: CaptchaChallenge = {
      id,
      prompt: `What is ${left} + ${right}?`,
      answer,
      expiresAt: new Date(this.now().getTime() + this.challengeTtlMs),
    };

    this.store.set(id, challenge);
    this.logger.debug('Created reset captcha challenge', {
      id,
      prompt: challenge.prompt,
    });
    return { challengeId: id, prompt: challenge.prompt };
  }

  async validateChallenge(
    challengeId: string,
    answer: string,
  ): Promise<boolean> {
    this.purgeExpiredChallenges();
    const challenge = this.store.get(challengeId);
    if (!challenge) {
      return false;
    }

    if (challenge.expiresAt < this.now()) {
      this.store.delete(challengeId);
      return false;
    }

    const provided = String(answer ?? '').trim();
    if (challenge.answer !== provided) {
      return false;
    }

    this.store.delete(challengeId);
    return true;
  }

  purgeExpiredChallenges(): void {
    const now = this.now();
    this.store.forEach((challenge, id) => {
      if (challenge.expiresAt < now) {
        this.store.delete(id);
      }
    });
  }
}
