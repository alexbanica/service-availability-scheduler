import { createHash, randomBytes } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { AccountActivationTokenRepository } from '../repositories/AccountActivationTokenRepository';
import type { MysqlConnection } from '../repositories/AbstractMysqlRepository';
import type { UserService } from './UserService';

export type AccountActivationTokenValidation = {
  tokenId: string;
  userId: string;
};

export class AccountActivationTokenService {
  constructor(
    private readonly repository: AccountActivationTokenRepository,
    private readonly tokenExpiresInSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly db?: Pool,
  ) {
    if (!Number.isFinite(tokenExpiresInSeconds) || tokenExpiresInSeconds <= 0) {
      throw new Error('tokenExpiresInSeconds must be greater than zero');
    }
  }

  async createTokenForUser(
    userId: string,
    connection?: MysqlConnection,
  ): Promise<string> {
    const now = this.now();
    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      now.getTime() + this.tokenExpiresInSeconds * 1000,
    );
    const repository = connection
      ? this.repository.withConnection(connection)
      : this.repository;

    await repository.invalidateActiveTokensForUser(userId, now);
    await repository.createToken(userId, tokenHash, expiresAt);

    return token;
  }

  async validateToken(
    token: string,
  ): Promise<AccountActivationTokenValidation | null> {
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
    connection?: MysqlConnection,
  ): Promise<AccountActivationTokenValidation | null> {
    const now = this.now();
    const tokenHash = this.hashToken(token);
    const repository = connection
      ? this.repository.withConnection(connection)
      : this.repository;
    const tokenRecord = connection
      ? await repository.findActiveByHashForUpdate(tokenHash, now)
      : await repository.findActiveByHash(tokenHash, now);
    if (!tokenRecord || tokenRecord.used) {
      return null;
    }

    const consumed = await repository.markTokenUsed(tokenRecord.tokenId, now);
    if (!consumed) {
      return null;
    }
    await repository.invalidateActiveTokensForUserExcept(
      tokenRecord.userId,
      tokenRecord.tokenId,
      now,
    );

    return {
      tokenId: tokenRecord.tokenId,
      userId: tokenRecord.userId,
    };
  }

  async activateAccount(
    token: string,
    userService: UserService,
  ): Promise<AccountActivationTokenValidation | null> {
    if (!this.db) {
      const consumed = await this.consumeToken(token);
      if (!consumed) {
        return null;
      }
      await userService.setUserActivated(consumed.userId, true);
      await userService.grantPlatformAdminRole(consumed.userId);
      return consumed;
    }

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const consumed = await this.consumeToken(token, connection);
      if (!consumed) {
        await connection.rollback();
        return null;
      }
      await userService.setUserActivated(consumed.userId, true, connection);
      await userService.grantPlatformAdminRole(consumed.userId, connection);
      await connection.commit();
      return consumed;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
