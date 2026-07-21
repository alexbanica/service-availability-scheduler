import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromRoot = createRequire(process.cwd() + '/');

const OWNED_WORKSPACE_CONFLICT_MESSAGE =
  'Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account.';

type AccountDeletionResult =
  | { status: 'deleted' }
  | { status: 'user_not_found' }
  | { status: 'confirmation_mismatch' }
  | { status: 'owned_workspace_conflict'; error: string };

type AccountDeletionServiceConstructor = {
  new (
    repository: unknown,
    userService: unknown,
    db: unknown,
  ): {
    deleteCurrentUser(
      userId: string,
      confirmationEmail: string,
    ): Promise<AccountDeletionResult>;
  };
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

class FakeUserService {
  public readonly findByIdCalls: string[] = [];

  constructor(
    private readonly user: { userId: string; email: string } | null,
  ) {}

  async findById(userId: string): Promise<{
    userId: string;
    email: string;
  } | null> {
    this.findByIdCalls.push(userId);
    return this.user;
  }
}

class FakeAccountDeletionRepository {
  public withConnectionCalls = 0;
  public withConnectionArg: unknown = null;
  public blockingCheckCalls: string[] = [];
  public deleteCalls: Array<{ userId: string; normalizedEmail: string }> = [];
  public hasBlockingOwnedWorkspace = false;
  public deleteError: Error | null = null;

  withConnection(connection: unknown): FakeAccountDeletionRepository {
    this.withConnectionCalls += 1;
    this.withConnectionArg = connection;
    return this;
  }

  async hasOwnedWorkspaceWithOtherMembers(userId: string): Promise<boolean> {
    this.blockingCheckCalls.push(userId);
    return this.hasBlockingOwnedWorkspace;
  }

  async deleteAttributableData(
    userId: string,
    normalizedEmail: string,
  ): Promise<void> {
    this.deleteCalls.push({ userId, normalizedEmail });
    if (this.deleteError) {
      throw this.deleteError;
    }
  }
}

function loadService(): AccountDeletionServiceConstructor | null {
  try {
    const modulePath = path.join(
      process.cwd(),
      'src',
      'services',
      'AccountDeletionService.ts',
    );
    const required = requireFromRoot(modulePath) as {
      AccountDeletionService: AccountDeletionServiceConstructor;
    };
    return required.AccountDeletionService;
  } catch {
    return null;
  }
}

function assertServiceAvailable(
  service: AccountDeletionServiceConstructor | null,
): asserts service is AccountDeletionServiceConstructor {
  assert.ok(
    service,
    'AccountDeletionService must exist to run account deletion rules tests',
  );
}

function createFixture(options?: {
  user?: { userId: string; email: string } | null;
  hasBlockingOwnedWorkspace?: boolean;
}) {
  const repository = new FakeAccountDeletionRepository();
  repository.hasBlockingOwnedWorkspace =
    options?.hasBlockingOwnedWorkspace ?? false;
  const userService = new FakeUserService(
    options && 'user' in options
      ? (options.user ?? null)
      : { userId: 'user-1', email: 'Alice@Example.COM' },
  );
  const db = new FakeMySqlPool();

  return { repository, userService, db };
}

test('AccountDeletionService normalizes the database and confirmation emails before deleting and commits', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);
  const { repository, userService, db } = createFixture();
  const service = new Service(repository, userService, db);

  const result = await service.deleteCurrentUser(
    'user-1',
    '  alice@example.com  ',
  );

  assert.deepEqual(result, { status: 'deleted' });
  assert.deepEqual(userService.findByIdCalls, ['user-1']);
  assert.equal(db.getConnectionCalls, 1);
  assert.equal(repository.withConnectionCalls, 1);
  assert.equal(repository.withConnectionArg, db.connection);
  assert.deepEqual(repository.blockingCheckCalls, ['user-1']);
  assert.deepEqual(repository.deleteCalls, [
    { userId: 'user-1', normalizedEmail: 'alice@example.com' },
  ]);
  assert.equal(db.connection.beginTransactionCalls, 1);
  assert.equal(db.connection.commitCalls, 1);
  assert.equal(db.connection.rollbackCalls, 0);
  assert.equal(db.connection.releaseCalls, 1);
});

test('AccountDeletionService rejects a normalized confirmation mismatch before opening a transaction', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);
  const { repository, userService, db } = createFixture();
  const service = new Service(repository, userService, db);

  const result = await service.deleteCurrentUser('user-1', 'other@example.com');

  assert.deepEqual(result, { status: 'confirmation_mismatch' });
  assert.deepEqual(userService.findByIdCalls, ['user-1']);
  assert.equal(db.getConnectionCalls, 0);
  assert.deepEqual(repository.blockingCheckCalls, []);
  assert.deepEqual(repository.deleteCalls, []);
});

test('AccountDeletionService reports a missing current user without opening a transaction', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);
  const { repository, userService, db } = createFixture({ user: null });
  const service = new Service(repository, userService, db);

  const result = await service.deleteCurrentUser(
    'missing-user',
    'missing@example.com',
  );

  assert.deepEqual(result, { status: 'user_not_found' });
  assert.deepEqual(userService.findByIdCalls, ['missing-user']);
  assert.equal(db.getConnectionCalls, 0);
  assert.deepEqual(repository.blockingCheckCalls, []);
  assert.deepEqual(repository.deleteCalls, []);
});

test('AccountDeletionService short-circuits an owned shared workspace with the exact conflict result', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);
  const { repository, userService, db } = createFixture({
    hasBlockingOwnedWorkspace: true,
  });
  const service = new Service(repository, userService, db);

  const result = await service.deleteCurrentUser('user-1', 'alice@example.com');

  assert.deepEqual(result, {
    status: 'owned_workspace_conflict',
    error: OWNED_WORKSPACE_CONFLICT_MESSAGE,
  });
  assert.deepEqual(repository.blockingCheckCalls, ['user-1']);
  assert.deepEqual(repository.deleteCalls, []);
  assert.equal(db.connection.beginTransactionCalls, 1);
  assert.equal(db.connection.commitCalls, 0);
  assert.equal(db.connection.rollbackCalls, 1);
  assert.equal(db.connection.releaseCalls, 1);
});

test('AccountDeletionService rolls back and rethrows when repository deletion fails', async () => {
  const Service = loadService();
  assertServiceAvailable(Service);
  const { repository, userService, db } = createFixture();
  const service = new Service(repository, userService, db);
  repository.deleteError = new Error('injected deletion failure');

  await assert.rejects(
    () => service.deleteCurrentUser('user-1', 'alice@example.com'),
    /injected deletion failure/,
  );

  assert.deepEqual(repository.blockingCheckCalls, ['user-1']);
  assert.deepEqual(repository.deleteCalls, [
    { userId: 'user-1', normalizedEmail: 'alice@example.com' },
  ]);
  assert.equal(db.connection.beginTransactionCalls, 1);
  assert.equal(db.connection.commitCalls, 0);
  assert.equal(db.connection.rollbackCalls, 1);
  assert.equal(db.connection.releaseCalls, 1);
});
