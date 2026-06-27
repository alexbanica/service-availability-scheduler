import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../../services/WorkspaceService';
import { Workspace } from '../../entities/Workspace';
import { WorkspaceInvitation } from '../../entities/WorkspaceInvitation';

class FakeUserRoleRepository {
  constructor(private readonly admins: Set<string>) {}

  async isPlatformAdmin(userId: string): Promise<boolean> {
    return this.admins.has(userId);
  }
}

class FakeWorkspaceRepository {
  constructor(
    private readonly workspaces: Map<string, Workspace>,
    private readonly listByUserImpl?: (userId: string) => Promise<Workspace[]>,
  ) {}

  withConnection(): FakeWorkspaceRepository {
    return this;
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) || null;
  }

  async listByUser(userId: string): Promise<Workspace[]> {
    return this.listByUserImpl
      ? this.listByUserImpl(userId)
      : Array.from(this.workspaces.values());
  }

  async countByAdmin(): Promise<number> {
    return 0;
  }

  async insert(
    workspaceId: string,
    name: string,
    adminUserId: string,
  ): Promise<Workspace> {
    return new Workspace(workspaceId, name, adminUserId, 1, 0, 0, 0);
  }
}

class FakeWorkspaceUserRepository {
  private readonly admins = new Set<string>();
  private readonly members = new Set<string>();

  withConnection(): FakeWorkspaceUserRepository {
    return this;
  }

  setAdmin(workspaceId: string, userId: string): void {
    this.admins.add(`${workspaceId}:${userId}`);
    this.members.add(`${workspaceId}:${userId}`);
  }

  setMember(workspaceId: string, userId: string): void {
    this.members.add(`${workspaceId}:${userId}`);
  }

  async insert(): Promise<void> {
    return undefined;
  }

  async isAdmin(workspaceId: string, userId: string): Promise<boolean> {
    return this.admins.has(`${workspaceId}:${userId}`);
  }

  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    return this.members.has(`${workspaceId}:${userId}`);
  }
}

class FakeServiceRepository {
  withConnection(): FakeServiceRepository {
    return this;
  }

  async isWorkspaceOwnerOwnedByWorkspace(): Promise<boolean> {
    return true;
  }

  async findServiceByWorkspaceAndId(): Promise<{ serviceId: string } | null> {
    return { serviceId: 'service-1' };
  }

  async updateServiceMetadata(): Promise<void> {
    return undefined;
  }

  async getEnvironmentById(): Promise<boolean> {
    return true;
  }

  async insertServiceEnvironment(): Promise<void> {
    return undefined;
  }

  async deleteServiceEnvironmentAssociationsNotIn(): Promise<void> {
    return undefined;
  }
}

class FakeInvitationRepository {
  async insert(): Promise<WorkspaceInvitation> {
    return new WorkspaceInvitation(
      'invitation-1',
      'workspace-1',
      'user-2',
      'user-1',
      'pending',
      new Date(),
    );
  }
}

class FakeUserRepository {
  constructor(private readonly emailMap: Map<string, string>) {}

  async findByEmail(email: string): Promise<{ userId: string } | null> {
    const userId = this.emailMap.get(email);
    return userId ? { userId } : null;
  }
}

class FakePool {
  async getConnection(): Promise<{
    beginTransaction: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
    release: () => void;
  }> {
    return {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
    };
  }
}

function makeService(
  workspaces: Map<string, Workspace>,
  workspaceUsers = new FakeWorkspaceUserRepository(),
): WorkspaceService {
  return new WorkspaceService(
    new FakePool() as never,
    new FakeWorkspaceRepository(workspaces) as never,
    workspaceUsers as never,
    new FakeServiceRepository() as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map([['user@example.com', 'user-2']])) as never,
    new FakeUserRoleRepository(new Set(['user-1'])) as never,
  );
}

test('createService requires workspace admin', async () => {
  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0),
      ],
    ]),
  );

  await assert.rejects(
    () =>
      service.createService('workspace-1', 'user-2', {
        environmentIds: ['environment-1'],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /Not authorized for workspace/,
  );
});

test('createService requires at least one environment', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'user-1');
  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  await assert.rejects(
    () =>
      service.createService('workspace-1', 'user-1', {
        environmentIds: [],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /Select at least one environment/,
  );
});

test('updateService requires workspace admin', async () => {
  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0),
      ],
    ]),
  );

  await assert.rejects(
    () =>
      service.updateService('workspace-1', 'user-2', {
        serviceId: 'service-1',
        environmentIds: ['environment-1'],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /Not authorized for workspace/,
  );
});

test('updateService validates deterministic inputs before persistence', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'user-1');
  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  await assert.rejects(
    () =>
      service.updateService('workspace-1', 'user-1', {
        serviceId: 'service-1',
        environmentIds: ['environment-1'],
        label: '   ',
        defaultMinutes: 10,
      }),
    /Service name required/,
  );
  await assert.rejects(
    () =>
      service.updateService('workspace-1', 'user-1', {
        serviceId: 'service-1',
        environmentIds: [],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /Select at least one environment/,
  );
  await assert.rejects(
    () =>
      service.updateService('workspace-1', 'user-1', {
        serviceId: 'service-1',
        environmentIds: ['environment-1'],
        label: 'svc',
        defaultMinutes: 0,
      }),
    /Default minutes must be positive/,
  );
});

test('inviteUser fails when user already member', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'user-1');
  workspaceUsers.setMember('workspace-1', 'user-2');
  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  await assert.rejects(
    () => service.inviteUser('workspace-1', 'user-1', 'user@example.com'),
    /User already in workspace/,
  );
});
