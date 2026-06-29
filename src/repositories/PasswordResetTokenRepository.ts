import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

export type PasswordResetTokenRecord = {
  tokenId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  invalidatedAt: Date | null;
};

type PasswordResetTokenRow = RowDataPacket & {
  token_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used: number;
  invalidated_at: Date | null;
};

export class PasswordResetTokenRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async createToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string> {
    const tokenId = randomUUID();
    await this.run(
      `INSERT INTO password_reset_tokens
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
      `UPDATE password_reset_tokens
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
      `UPDATE password_reset_tokens
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
  ): Promise<PasswordResetTokenRecord | null> {
    const row = await this.get<PasswordResetTokenRow>(
      `SELECT
         token_id,
         user_id,
         token_hash,
         expires_at,
         used,
         invalidated_at
       FROM password_reset_tokens
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

  async markTokenUsed(tokenId: string, now: Date): Promise<void> {
    await this.run(
      `UPDATE password_reset_tokens
       SET used = 1,
           used_at = ?
       WHERE token_id = ?`,
      [now, tokenId],
    );
  }

  async findById(tokenId: string): Promise<PasswordResetTokenRecord | null> {
    const row = await this.get<PasswordResetTokenRow>(
      `SELECT
         token_id,
         user_id,
         token_hash,
         expires_at,
         used,
         invalidated_at
       FROM password_reset_tokens
       WHERE token_id = ?
       LIMIT 1`,
      [tokenId],
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
}
