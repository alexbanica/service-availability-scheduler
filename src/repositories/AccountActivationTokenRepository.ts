import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

export type AccountActivationTokenRecord = {
  tokenId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  invalidatedAt: Date | null;
};

type AccountActivationTokenRow = RowDataPacket & {
  token_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used: number;
  invalidated_at: Date | null;
};

export class AccountActivationTokenRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  withConnection(
    connection: MysqlConnection,
  ): AccountActivationTokenRepository {
    return new AccountActivationTokenRepository(connection);
  }

  async createToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string> {
    const tokenId = randomUUID();
    await this.run(
      `INSERT INTO account_activation_tokens
         (token_id, user_id, token_hash, expires_at)
       VALUES
         (?, ?, ?, ?)`,
      [tokenId, userId, tokenHash, expiresAt],
    );
    return tokenId;
  }

  async invalidateActiveTokensForUser(
    userId: string,
    now: Date,
  ): Promise<void> {
    await this.run(
      `UPDATE account_activation_tokens
       SET invalidated_at = ?
       WHERE user_id = ?
         AND used = 0
         AND invalidated_at IS NULL`,
      [now, userId],
    );
  }

  async invalidateActiveTokensForUserExcept(
    userId: string,
    excludedTokenId: string,
    now: Date,
  ): Promise<void> {
    await this.run(
      `UPDATE account_activation_tokens
       SET invalidated_at = ?
       WHERE user_id = ?
         AND token_id != ?
         AND used = 0
         AND invalidated_at IS NULL`,
      [now, userId, excludedTokenId],
    );
  }

  async findActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<AccountActivationTokenRecord | null> {
    const row = await this.get<AccountActivationTokenRow>(
      `SELECT
         token_id,
         user_id,
         token_hash,
         expires_at,
         used,
         invalidated_at
       FROM account_activation_tokens
       WHERE token_hash = ?
         AND used = 0
         AND invalidated_at IS NULL
         AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash, now],
    );

    if (!row) {
      return null;
    }

    return {
      tokenId: row.token_id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      used: row.used === 1,
      invalidatedAt: row.invalidated_at || null,
    };
  }

  async findActiveByHashForUpdate(
    tokenHash: string,
    now: Date,
  ): Promise<AccountActivationTokenRecord | null> {
    const row = await this.get<AccountActivationTokenRow>(
      `SELECT
         token_id,
         user_id,
         token_hash,
         expires_at,
         used,
         invalidated_at
       FROM account_activation_tokens
       WHERE token_hash = ?
         AND used = 0
         AND invalidated_at IS NULL
         AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [tokenHash, now],
    );

    if (!row) {
      return null;
    }

    return {
      tokenId: row.token_id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      used: row.used === 1,
      invalidatedAt: row.invalidated_at || null,
    };
  }

  async markTokenUsed(tokenId: string, now: Date): Promise<boolean> {
    const result = await this.run(
      `UPDATE account_activation_tokens
       SET used = 1,
           used_at = ?
       WHERE token_id = ?
         AND used = 0
         AND invalidated_at IS NULL`,
      [now, tokenId],
    );

    return result.affectedRows > 0;
  }
}
