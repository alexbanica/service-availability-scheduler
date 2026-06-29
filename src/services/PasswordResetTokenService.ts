import { randomBytes, createHash } from 'node:crypto';
import { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository';

export type PasswordResetTokenValidation = {
  tokenId: string;
  userId: string;
};

export class PasswordResetTokenService {
  constructor(
    private readonly repository: PasswordResetTokenRepository,
    private readonly tokenExpiresInSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!Number.isFinite(tokenExpiresInSeconds) || tokenExpiresInSeconds <= 0) {
      throw new Error('tokenExpiresInSeconds must be greater than zero');
    }
  }

  async createTokenForUser(userId: string): Promise<string> {
    const now = this.now();
    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      now.getTime() + this.tokenExpiresInSeconds * 1000,
    );

    await this.repository.invalidateActiveTokensForUser(userId, now);
    await this.repository.createToken(userId, tokenHash, expiresAt);

    return token;
  }

  async validateToken(
    token: string,
  ): Promise<PasswordResetTokenValidation | null> {
    const now = this.now();
    const tokenHash = this.hashToken(token);
    const tokenRecord = await this.repository.findActiveByHash(tokenHash, now);
    if (!tokenRecord || tokenRecord.used) {
      return null;
    }
    return {
      tokenId: tokenRecord.tokenId,
      userId: tokenRecord.userId,
    };
  }

  async consumeToken(
    token: string,
  ): Promise<PasswordResetTokenValidation | null> {
    const now = this.now();
    const tokenHash = this.hashToken(token);
    const tokenRecord = await this.repository.findActiveByHash(tokenHash, now);
    if (!tokenRecord || tokenRecord.used) {
      return null;
    }

    await this.repository.markTokenUsed(tokenRecord.tokenId, now);
    await this.repository.invalidateActiveTokensForUserExcept(
      tokenRecord.userId,
      tokenRecord.tokenId,
      now,
    );

    return {
      tokenId: tokenRecord.tokenId,
      userId: tokenRecord.userId,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
