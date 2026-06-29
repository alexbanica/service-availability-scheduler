import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { PasswordResetTokenService } from '../../services/PasswordResetTokenService';
import type { PasswordResetTokenRecord } from '../../repositories/PasswordResetTokenRepository';
import type { PasswordResetTokenRepository } from '../../repositories/PasswordResetTokenRepository';

type RepoCall = {
  method: string;
  args: Array<unknown>;
};

class PasswordResetTokenRepositoryStub {
  public readonly calls: RepoCall[] = [];
  public readonly tokenRecord: PasswordResetTokenRecord;
  public markTokenUsedArgs: RepoCall | null = null;
  public createTokenArgs: Array<unknown> | null = null;
  public invalidateArgs: RepoCall | null = null;
  public invalidateExceptArgs: RepoCall | null = null;

  constructor(
    tokenId: string,
    userId: string,
    token: string,
    public readonly expiresAt: Date,
    public readonly used = false,
  ) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    this.tokenRecord = {
      tokenId,
      userId,
      tokenHash,
      expiresAt,
      used,
      invalidatedAt: null,
    };
  }

  async createToken(
    userId: string,
    _tokenHash: string,
    expiresAt: Date,
  ): Promise<string> {
    this.calls.push({
      method: 'createToken',
      args: [userId, _tokenHash, expiresAt],
    });
    this.createTokenArgs = [userId, _tokenHash, expiresAt];
    return this.tokenRecord.tokenId;
  }

  async invalidateActiveTokensForUser(
    userId: string,
    now: Date,
  ): Promise<void> {
    this.calls.push({
      method: 'invalidateActiveTokensForUser',
      args: [userId, now],
    });
    this.invalidateArgs = {
      method: 'invalidateActiveTokensForUser',
      args: [userId, now],
    };
  }

  async invalidateActiveTokensForUserExcept(
    userId: string,
    tokenId: string,
    now: Date,
  ): Promise<void> {
    this.calls.push({
      method: 'invalidateActiveTokensForUserExcept',
      args: [userId, tokenId, now],
    });
    this.invalidateExceptArgs = {
      method: 'invalidateActiveTokensForUserExcept',
      args: [userId, tokenId, now],
    };
  }

  async findActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null> {
    this.calls.push({ method: 'findActiveByHash', args: [tokenHash, now] });
    if (
      tokenHash !== this.tokenRecord.tokenHash ||
      this.tokenRecord.used ||
      this.tokenRecord.invalidatedAt !== null ||
      this.tokenRecord.expiresAt <= now
    ) {
      return null;
    }
    return this.tokenRecord;
  }

  async markTokenUsed(tokenId: string, now: Date): Promise<void> {
    this.calls.push({ method: 'markTokenUsed', args: [tokenId, now] });
    this.markTokenUsedArgs = { method: 'markTokenUsed', args: [tokenId, now] };
  }
}

test('PasswordResetTokenService.consumeToken marks used token before invalidating siblings', async () => {
  const now = new Date('2025-01-01T00:00:00.000Z');
  const expiresAt = new Date('2025-01-01T01:00:00.000Z');
  const token = 'raw-token';
  const repository = new PasswordResetTokenRepositoryStub(
    'token-id-1',
    'user-1',
    token,
    expiresAt,
  );
  const service = new PasswordResetTokenService(
    repository as unknown as PasswordResetTokenRepository,
    3600,
    () => now,
  );

  const valid = await service.consumeToken(token);

  assert.equal(valid?.tokenId, 'token-id-1');
  assert.equal(valid?.userId, 'user-1');
  assert.deepEqual(
    repository.calls.map((call) => call.method),
    [
      'findActiveByHash',
      'markTokenUsed',
      'invalidateActiveTokensForUserExcept',
    ],
  );
  assert.equal(repository.invalidateArgs, null);
  assert.equal(repository.invalidateExceptArgs?.args[0], 'user-1');
  assert.equal(repository.invalidateExceptArgs?.args[1], 'token-id-1');
});

test('PasswordResetTokenService.createTokenForUser invalidates active tokens first', async () => {
  const now = new Date('2025-01-01T00:00:00.000Z');
  const expiresAt = new Date('2025-01-01T01:00:00.000Z');
  const token = 'raw-token';
  const repository = new PasswordResetTokenRepositoryStub(
    'token-id-1',
    'user-1',
    token,
    expiresAt,
  );
  const service = new PasswordResetTokenService(
    repository as unknown as PasswordResetTokenRepository,
    3600,
    () => now,
  );

  await service.createTokenForUser('user-1');

  assert.deepEqual(
    repository.calls.slice(0, 2).map((call) => call.method),
    ['invalidateActiveTokensForUser', 'createToken'],
  );
});
