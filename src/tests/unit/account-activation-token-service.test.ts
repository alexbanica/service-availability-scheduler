import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromRoot = createRequire(process.cwd() + '/');

type AccountActivationTokenServiceConstructor = {
  new (
    repository: unknown,
    tokenLifetimeSeconds: number,
    now?: () => Date,
    db?: unknown,
  ): {
    createTokenForUser(userId: string): Promise<string>;
    validateToken(token: string): Promise<AccountActivationTokenRecord | null>;
    consumeToken(token: string): Promise<AccountActivationTokenRecord | null>;
    activateAccount(
      token: string,
      userService: unknown,
    ): Promise<AccountActivationTokenRecord | null>;
  };
};

type AccountActivationTokenRecord = {
  tokenId: string;
  userId: string;
};

type RepoCall = {
  method: string;
  args: Array<unknown>;
};

class FakeMySqlConnection {
  public beginTransactionCalls = 0;
  public commitCalls = 0;
  public rollbackCalls = 0;
  public releaseCalls = 0;

  async beginTransaction(): Promise<void> {
    this.beginTransactionCalls += 1;
  }

  async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  async rollback(): Promise<void> {
    this.rollbackCalls += 1;
  }

  async release(): Promise<void> {
    this.releaseCalls += 1;
  }
}

class FakeMySqlPool {
  public getConnectionCalls = 0;
  public readonly connection = new FakeMySqlConnection();

  async getConnection(): Promise<FakeMySqlConnection> {
    this.getConnectionCalls += 1;
    return this.connection;
  }
}

class FakeActivationUserService {
  public activatedArgs: Array<{
    userId: string;
    activated: boolean;
    connection: unknown;
  }> = [];
  public grantedRoleArgs: Array<{
    userId: string;
    connection: unknown;
  }> = [];

  async setUserActivated(
    userId: string,
    activated = true,
    connection?: unknown,
  ): Promise<void> {
    this.activatedArgs.push({
      userId,
      activated,
      connection: connection ?? null,
    });
  }

  async grantPlatformAdminRole(
    userId: string,
    connection?: unknown,
  ): Promise<void> {
    this.grantedRoleArgs.push({
      userId,
      connection: connection ?? null,
    });
  }
}

class AccountActivationTokenRepositoryStub {
  public readonly calls: RepoCall[] = [];
  public markTokenUsedArgs: RepoCall | null = null;
  public markTokenUsedCalls: Array<RepoCall> = [];
  public markTokenUsedResults: Array<boolean> = [];
  public createTokenArgs: Array<unknown> | null = null;
  public invalidateArgs: RepoCall | null = null;
  public invalidateExceptArgs: RepoCall | null = null;
  public withConnectionCalls = 0;
  public withConnectionArg: unknown = null;
  public findActiveByHashForUpdateCalls = 0;

  public readonly tokenRecord: {
    tokenId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    used: boolean;
    invalidatedAt: Date | null;
  };

  constructor(
    tokenId: string,
    userId: string,
    token: string,
    expiresAt: Date,
    used = false,
    invalidatedAt: Date | null = null,
  ) {
    this.tokenRecord = {
      tokenId,
      userId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt,
      used,
      invalidatedAt,
    };
  }

  async createToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string> {
    this.calls.push({
      method: 'createToken',
      args: [userId, tokenHash, expiresAt],
    });
    this.createTokenArgs = [userId, tokenHash, expiresAt];
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
  ): Promise<AccountActivationTokenRecord | null> {
    this.calls.push({ method: 'findActiveByHash', args: [tokenHash, now] });
    if (
      tokenHash !== this.tokenRecord.tokenHash ||
      this.tokenRecord.used ||
      this.tokenRecord.invalidatedAt !== null ||
      this.tokenRecord.expiresAt <= now
    ) {
      return null;
    }

    return {
      tokenId: this.tokenRecord.tokenId,
      userId: this.tokenRecord.userId,
    };
  }

  async findActiveByHashForUpdate(
    tokenHash: string,
    now: Date,
  ): Promise<AccountActivationTokenRecord | null> {
    this.findActiveByHashForUpdateCalls += 1;
    return this.findActiveByHash(tokenHash, now);
  }

  async markTokenUsed(tokenId: string, now: Date): Promise<boolean> {
    this.calls.push({ method: 'markTokenUsed', args: [tokenId, now] });
    this.markTokenUsedArgs = { method: 'markTokenUsed', args: [tokenId, now] };
    this.markTokenUsedCalls.push({
      method: 'markTokenUsed',
      args: [tokenId, now],
    });
    const result = this.markTokenUsedResults.shift() ?? true;
    return Promise.resolve(result);
  }

  withConnection(connection: unknown): AccountActivationTokenRepositoryStub {
    this.withConnectionCalls += 1;
    this.withConnectionArg = connection;
    return this;
  }
}

function loadService(): AccountActivationTokenServiceConstructor | null {
  try {
    const modulePath = path.join(
      process.cwd(),
      'src',
      'services',
      'AccountActivationTokenService.ts',
    );
    const required = requireFromRoot(modulePath) as {
      AccountActivationTokenService: AccountActivationTokenServiceConstructor;
    };
    return required.AccountActivationTokenService;
  } catch {
    return null;
  }
}

function assertServiceAvailable(
  service: AccountActivationTokenServiceConstructor | null,
): asserts service is AccountActivationTokenServiceConstructor {
  assert.ok(
    service,
    'AccountActivationTokenService must exist to run token lifecycle tests',
  );
}

test('AccountActivationTokenService.consumeToken marks used token before invalidating siblings', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);

  const now = new Date('2025-01-01T00:00:00.000Z');
  const expiresAt = new Date('2025-01-01T01:00:00.000Z');
  const token = 'raw-token';
  const repository = new AccountActivationTokenRepositoryStub(
    'token-id-1',
    'user-1',
    token,
    expiresAt,
  );
  const service = new Service(repository as never, 3600, () => now);

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
  assert.equal(repository.markTokenUsedCalls.length, 1);
});

test('AccountActivationTokenService.consumeToken is safe against concurrent duplicate consume attempts', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);

  const now = new Date('2025-01-01T00:00:00.000Z');
  const expiresAt = new Date('2025-01-01T01:00:00.000Z');
  const token = 'raw-token';
  const repository = new AccountActivationTokenRepositoryStub(
    'token-id-1',
    'user-1',
    token,
    expiresAt,
  );
  repository.markTokenUsedResults = [true, false];
  const service = new Service(repository as never, 3600, () => now);

  const first = service.consumeToken(token);
  const second = service.consumeToken(token);

  const results = await Promise.all([first, second]);

  assert.equal(results.filter((result) => result !== null).length, 1);
  assert.equal(results[0]?.userId, 'user-1');
  assert.equal(repository.markTokenUsedCalls.length, 2);
  assert.equal(repository.invalidateExceptArgs?.args[1], 'token-id-1');
});

test('AccountActivationTokenService.createTokenForUser invalidates prior active tokens', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);

  const now = new Date('2025-01-01T00:00:00.000Z');
  const expiresAt = new Date('2025-01-01T01:00:00.000Z');
  const repository = new AccountActivationTokenRepositoryStub(
    'token-id-1',
    'user-1',
    'raw-token',
    expiresAt,
  );
  const service = new Service(repository as never, 3600, () => now);

  await service.createTokenForUser('user-1');

  assert.deepEqual(
    repository.calls.slice(0, 2).map((call) => call.method),
    ['invalidateActiveTokensForUser', 'createToken'],
  );
  assert.equal(repository.invalidateArgs?.args[0], 'user-1');
  assert.equal(repository.createTokenArgs?.[0], 'user-1');
});

test('AccountActivationTokenService.validateToken classifies invalid, used, invalidated, and expired tokens as missing', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);
  const rawToken = 'raw-token';

  const activeUntil = new Date('2025-01-01T01:00:00.000Z');
  const now = new Date('2025-01-01T00:00:00.000Z');
  const nowAtExpiry = new Date('2025-01-01T02:00:00.000Z');

  const validRepository = new AccountActivationTokenRepositoryStub(
    'token-id-valid',
    'user-1',
    rawToken,
    activeUntil,
  );
  const usedRepository = new AccountActivationTokenRepositoryStub(
    'token-id-used',
    'user-1',
    rawToken,
    activeUntil,
    true,
  );
  const invalidatedRepository = new AccountActivationTokenRepositoryStub(
    'token-id-invalidated',
    'user-1',
    rawToken,
    activeUntil,
    false,
    new Date('2024-12-31T23:59:00.000Z'),
  );
  const expiredRepository = new AccountActivationTokenRepositoryStub(
    'token-id-expired',
    'user-1',
    rawToken,
    new Date('2024-01-01T00:00:00.000Z'),
  );

  const validService = new Service(validRepository as never, 3600, () => now);
  const usedService = new Service(usedRepository as never, 3600, () => now);
  const invalidatedService = new Service(
    invalidatedRepository as never,
    3600,
    () => now,
  );
  const expiredService = new Service(
    expiredRepository as never,
    3600,
    () => nowAtExpiry,
  );

  const valid = await validService.validateToken(rawToken);
  const used = await usedService.validateToken(rawToken);
  const invalidated = await invalidatedService.validateToken(rawToken);
  const expired = await expiredService.validateToken(rawToken);

  assert.deepEqual(valid, { tokenId: 'token-id-valid', userId: 'user-1' });
  assert.equal(used, null);
  assert.equal(invalidated, null);
  assert.equal(expired, null);
});

test('AccountActivationTokenService.activateAccount uses a transaction when DB is configured', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);

  const now = new Date('2025-01-01T00:00:00.000Z');
  const token = 'raw-token';
  const repository = new AccountActivationTokenRepositoryStub(
    'token-id-1',
    'user-1',
    token,
    new Date('2025-01-01T01:00:00.000Z'),
  );
  const pool = new FakeMySqlPool();
  const userService = new FakeActivationUserService();
  const service = new Service(
    repository as never,
    3600,
    () => now,
    pool as never,
  );

  const activated = await service.activateAccount(token, userService as never);

  assert.equal(activated?.userId, 'user-1');
  assert.equal(pool.getConnectionCalls, 1);
  assert.equal(pool.connection.beginTransactionCalls, 1);
  assert.equal(pool.connection.commitCalls, 1);
  assert.equal(pool.connection.rollbackCalls, 0);
  assert.equal(pool.connection.releaseCalls, 1);
  assert.equal(repository.withConnectionCalls, 1);
  assert.equal(repository.withConnectionArg, pool.connection);
  assert.equal(repository.findActiveByHashForUpdateCalls, 1);
  assert.equal(userService.activatedArgs.length, 1);
  assert.equal(userService.activatedArgs[0].userId, 'user-1');
  assert.equal(userService.activatedArgs[0].activated, true);
  assert.equal(userService.activatedArgs[0].connection, pool.connection);
  assert.equal(userService.grantedRoleArgs.length, 1);
  assert.equal(userService.grantedRoleArgs[0].userId, 'user-1');
  assert.equal(userService.grantedRoleArgs[0].connection, pool.connection);
});

test('AccountActivationTokenService.activateAccount falls back to direct path when DB is not configured', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);

  const now = new Date('2025-01-01T00:00:00.000Z');
  const token = 'raw-token';
  const repository = new AccountActivationTokenRepositoryStub(
    'token-id-1',
    'user-1',
    token,
    new Date('2025-01-01T01:00:00.000Z'),
  );
  const userService = new FakeActivationUserService();
  const service = new Service(repository as never, 3600, () => now);

  const activated = await service.activateAccount(token, userService as never);

  assert.equal(activated?.userId, 'user-1');
  assert.equal(userService.activatedArgs.length, 1);
  assert.equal(userService.activatedArgs[0].connection, null);
  assert.equal(userService.grantedRoleArgs.length, 1);
  assert.equal(userService.grantedRoleArgs[0].connection, null);
  assert.equal(repository.withConnectionCalls, 0);
});
