import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../../services/WorkspaceService';
import { Workspace } from '../../entities/Workspace';
import { WorkspaceInvitation } from '../../entities/WorkspaceInvitation';

class FakeUserRoleRepository {
  constructor(private readonly admins: Set<number>) {}

  async isPlatformAdmin(userId: number): Promise<boolean> {
    return this.admins.has(userId);
  }
}

class FakeWorkspaceRepository {
  constructor(private readonly workspaces: Map<number, Workspace>) {}

  async findById(id: number): Promise<Workspace | null> {
    return this.workspaces.get(id) || null;
  }

  async listByUser(): Promise<Workspace[]> {
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
    [3, new Workspace(3, 'A', 1)],
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
        environmentId: 'env',
        environmentName: 'Env',
        serviceId: 'svc',
        defaultMinutes: 10,
      }),
    /Not authorized for workspace/,
  );
});

test('createService reports duplicates', async () => {
  const workspaces = new Map<number, Workspace>([
    [3, new Workspace(3, 'A', 1)],
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
        environmentId: 'env',
        environmentName: 'Env',
        serviceId: 'svc',
        defaultMinutes: 10,
      }),
    /Service already exists/,
  );
});

test('inviteUser fails when user already member', async () => {
  const workspaces = new Map<number, Workspace>([
    [7, new Workspace(7, 'A', 1)],
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
