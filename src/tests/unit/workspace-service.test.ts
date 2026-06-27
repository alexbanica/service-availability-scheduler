import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../../services/WorkspaceService';
import { Workspace } from '../../entities/Workspace';
import { WorkspaceInvitation } from '../../entities/WorkspaceInvitation';

type WorkspaceStats = {
  userCount?: number;
  serviceCount?: number;
  user_count?: number;
  service_count?: number;
};

function workspaceFixture(
  value: Omit<Workspace, keyof WorkspaceStats> & WorkspaceStats,
): Workspace {
  return value as Workspace;
}

function getWorkspaceUserCount(workspace: Workspace): number {
  const workspaceStats = workspace as Workspace & WorkspaceStats;
  const count = workspaceStats.userCount ?? workspaceStats.user_count;
  if (count === undefined) {
    throw new Error('Workspace summary is missing userCount');
  }
  return count;
}

function getWorkspaceServiceCount(workspace: Workspace): number {
  const workspaceStats = workspace as Workspace & WorkspaceStats;
  const count = workspaceStats.serviceCount ?? workspaceStats.service_count;
  if (count === undefined) {
    throw new Error('Workspace summary is missing serviceCount');
  }
  return count;
}

function assertWorkspaceSummaryCounts(
  workspace: Workspace,
  expectedUserCount: number,
  expectedServiceCount: number,
): void {
  assert.equal(getWorkspaceUserCount(workspace), expectedUserCount);
  assert.equal(getWorkspaceServiceCount(workspace), expectedServiceCount);
}

class FakeUserRoleRepository {
  constructor(private readonly admins: Set<number>) {}

  async isPlatformAdmin(userId: number): Promise<boolean> {
    return this.admins.has(userId);
  }
}

class FakeWorkspaceRepository {
  constructor(
    private readonly workspaces: Map<number, Workspace>,
    private readonly listByUserImpl?: (userId: number) => Promise<Workspace[]>,
  ) {}

  async findById(id: number): Promise<Workspace | null> {
    return this.workspaces.get(id) || null;
  }

  async listByUser(userId: number): Promise<Workspace[]> {
    if (this.listByUserImpl) {
      return this.listByUserImpl(userId);
    }
    return Array.from(this.workspaces.values());
  }
}

class FakeWorkspaceUserRepository {
  private readonly admins = new Set<string>();
  private readonly members = new Set<string>();

  setAdmin(workspaceId: number, userId: number): void {
    this.admins.add(`${workspaceId}:${userId}`);
    this.members.add(`${workspaceId}:${userId}`);
  }

  setMember(workspaceId: number, userId: number): void {
    this.members.add(`${workspaceId}:${userId}`);
  }

  async isAdmin(workspaceId: number, userId: number): Promise<boolean> {
    return this.admins.has(`${workspaceId}:${userId}`);
  }

  async isMember(workspaceId: number, userId: number): Promise<boolean> {
    return this.members.has(`${workspaceId}:${userId}`);
  }
}

class FakeServiceRepository {
  constructor(private readonly shouldDup: boolean) {}

  async insertService(): Promise<number> {
    if (this.shouldDup) {
      const err = new Error('dup') as Error & { code?: string };
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    return 42;
  }
}

class FakeInvitationRepository {
  async insert(): Promise<WorkspaceInvitation> {
    return new WorkspaceInvitation(11, 3, 5, 1, 'pending', new Date());
  }
}

class FakeUserRepository {
  constructor(private readonly emailMap: Map<string, number>) {}

  async findByEmail(email: string): Promise<{ id: number } | null> {
    const id = this.emailMap.get(email);
    return id ? { id } : null;
  }
}

class FakePool {
  constructor(private readonly adminCount: number) {}

  async getConnection(): Promise<{
    beginTransaction: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
    release: () => void;
    query: (
      sql: string,
      params: Array<unknown>,
    ) => Promise<
      [Array<{ total?: number }>, unknown] | [Record<string, number>, unknown]
    >;
  }> {
    let nextId = 1;
    return {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        if (sql.startsWith('SELECT COUNT(*)')) {
          return [[{ total: this.adminCount }], undefined];
        }
        if (sql.startsWith('INSERT INTO workspaces')) {
          return [{ insertId: nextId++ }, undefined] as [
            Record<string, number>,
            unknown,
          ];
        }
        return [[{}], undefined];
      },
    };
  }
}

test('createWorkspace rejects non-admins', async () => {
  const service = new WorkspaceService(
    new FakePool(0) as never,
    new FakeWorkspaceRepository(new Map()) as never,
    new FakeWorkspaceUserRepository() as never,
    new FakeServiceRepository(false) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map()) as never,
    new FakeUserRoleRepository(new Set()) as never,
  );

  await assert.rejects(
    () => service.createWorkspace(5, 'Team'),
    /Not authorized to create workspaces/,
  );
});

test('createWorkspace enforces max per admin', async () => {
  const service = new WorkspaceService(
    new FakePool(5) as never,
    new FakeWorkspaceRepository(new Map()) as never,
    new FakeWorkspaceUserRepository() as never,
    new FakeServiceRepository(false) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map()) as never,
    new FakeUserRoleRepository(new Set([1])) as never,
  );

  await assert.rejects(
    () => service.createWorkspace(1, 'Team'),
    /Workspace limit reached/,
  );
});

test('createService requires workspace admin', async () => {
  const workspaces = new Map<number, Workspace>([
    [3, workspaceFixture({ id: 3, name: 'A', adminUserId: 1 })],
  ]);
  const workspaceUsers = new FakeWorkspaceUserRepository();
  const service = new WorkspaceService(
    new FakePool(0) as never,
    new FakeWorkspaceRepository(workspaces) as never,
    workspaceUsers as never,
    new FakeServiceRepository(false) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map()) as never,
    new FakeUserRoleRepository(new Set([1])) as never,
  );

  await assert.rejects(
    () =>
      service.createService(3, 2, {
        environmentNames: ['Env'],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /Not authorized for workspace/,
  );
});

test('createService requires at least one environment', async () => {
  const workspaces = new Map<number, Workspace>([
    [3, workspaceFixture({ id: 3, name: 'A', adminUserId: 1 })],
  ]);
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin(3, 1);

  const service = new WorkspaceService(
    new FakePool(0) as never,
    new FakeWorkspaceRepository(workspaces) as never,
    workspaceUsers as never,
    new FakeServiceRepository(true) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map()) as never,
    new FakeUserRoleRepository(new Set([1])) as never,
  );

  await assert.rejects(
    () =>
      service.createService(3, 1, {
        environmentNames: [],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /At least one environment is required/,
  );
});

test('inviteUser fails when user already member', async () => {
  const workspaces = new Map<number, Workspace>([
    [7, workspaceFixture({ id: 7, name: 'A', adminUserId: 1 })],
  ]);
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin(7, 1);
  workspaceUsers.setMember(7, 5);

  const service = new WorkspaceService(
    new FakePool(0) as never,
    new FakeWorkspaceRepository(workspaces) as never,
    workspaceUsers as never,
    new FakeServiceRepository(false) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map([['user@example.com', 5]])) as never,
    new FakeUserRoleRepository(new Set([1])) as never,
  );

  await assert.rejects(
    () => service.inviteUser(7, 1, 'user@example.com'),
    /User already in workspace/,
  );
});

test('listWorkspaces exposes user and service counts', async () => {
  let requestedByUserId: number | undefined;
  const workspaces = new Map<number, Workspace>([
    [
      3,
      workspaceFixture({
        id: 3,
        name: 'Admin workspace',
        adminUserId: 1,
        userCount: 1,
        serviceCount: 4,
      }),
    ],
    [
      7,
      workspaceFixture({
        id: 7,
        name: 'Member workspace',
        adminUserId: 9,
        user_count: 3,
        service_count: 2,
      }),
    ],
  ]);
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin(3, 5);
  workspaceUsers.setMember(7, 5);

  const fakeRepository = new FakeWorkspaceRepository(
    workspaces,
    async (userId: number) => {
      requestedByUserId = userId;
      return Array.from(workspaces.values());
    },
  );

  const service = new WorkspaceService(
    new FakePool(0) as never,
    fakeRepository as never,
    workspaceUsers as never,
    new FakeServiceRepository(false) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map()) as never,
    new FakeUserRoleRepository(new Set([1])) as never,
  );

  const summaries = await service.listWorkspaces(5);

  assert.equal(summaries.length, 2);
  const adminWorkspace = summaries.find((workspace) => workspace.id === 3);
  const memberWorkspace = summaries.find((workspace) => workspace.id === 7);
  assert.ok(adminWorkspace);
  assert.ok(memberWorkspace);

  assert.equal(requestedByUserId, 5);

  assertWorkspaceSummaryCounts(adminWorkspace, 1, 4);
  assertWorkspaceSummaryCounts(memberWorkspace, 3, 2);
});

test('createWorkspace returns userCount/serviceCount in summary shape', async () => {
  const service = new WorkspaceService(
    new FakePool(0) as never,
    new FakeWorkspaceRepository(new Map()) as never,
    new FakeWorkspaceUserRepository() as never,
    new FakeServiceRepository(false) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map()) as never,
    new FakeUserRoleRepository(new Set([1])) as never,
  );

  const workspace = await service.createWorkspace(1, 'Team Alpha');

  assertWorkspaceSummaryCounts(workspace, 1, 0);
});
