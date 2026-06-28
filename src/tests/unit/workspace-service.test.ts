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
    private readonly workspaceUsers = new Map<
      string,
      Array<{ userId: string; email: string }>
    >(),
  ) {}

  withConnection(): FakeWorkspaceRepository {
    return this;
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) || null;
  }

  async listUsersByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ userId: string; email: string }>> {
    return this.workspaceUsers.get(workspaceId) || [];
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
  private readonly listCallCount = {
    users: 0,
    services: 0,
    owners: 0,
    environments: 0,
  };

  constructor(
    private readonly userRows = new Map<string, Array<{ userId: string; email: string }>>(),
    private readonly serviceRows = new Map<
      string,
      Array<{ serviceId: string; label: string }>
    >(),
    private readonly ownerRows = new Map<string, Array<{ ownerId: string; name: string }>>(),
    private readonly environmentRows = new Map<
      string,
      Array<{ environmentId: string; environmentName: string }>
    >(),
  ) {}

  get listCalls(): Readonly<typeof this.listCallCount> {
    return this.listCallCount;
  }

  withConnection(): FakeServiceRepository {
    return this;
  }

  async listUsersByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ userId: string; email: string }>> {
    this.listCallCount.users += 1;
    return this.userRows.get(workspaceId) || [];
  }

  async listServiceSummariesByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ serviceId: string; label: string }>> {
    this.listCallCount.services += 1;
    return this.serviceRows.get(workspaceId) || [];
  }

  async listOwnersByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ ownerId: string; name: string }>> {
    this.listCallCount.owners += 1;
    return this.ownerRows.get(workspaceId) || [];
  }

  async listEnvironmentsByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    this.listCallCount.environments += 1;
    return this.environmentRows.get(workspaceId) || [];
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
  listByUserImpl?: (userId: string) => Promise<Workspace[]>,
  workspaceUsersByWorkspace?: Map<string, Array<{ userId: string; email: string }>>,
  serviceRepository?: FakeServiceRepository,
): WorkspaceService {
  return new WorkspaceService(
    new FakePool() as never,
    new FakeWorkspaceRepository(
      workspaces,
      listByUserImpl,
      workspaceUsersByWorkspace,
    ) as never,
    workspaceUsers as never,
    (serviceRepository ?? new FakeServiceRepository()) as never,
    new FakeInvitationRepository() as never,
    new FakeUserRepository(new Map([['user@example.com', 'user-2']])) as never,
    new FakeUserRoleRepository(new Set(['user-1'])) as never,
  );
}

function extractPopupRowName(row: {
  name: string;
}): string {
  return row.name;
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

test('updateService requires nonblank label', async () => {
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
});

test('updateService requires at least one environment', async () => {
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
        environmentIds: [],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /At least one environment is required/,
  );
});

test('updateService requires positive default minutes', async () => {
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

test('listWorkspaces exposes summary stats for admin and member workspaces', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-admin', 'user-1');
  workspaceUsers.setMember('workspace-member', 'user-1');

  const adminWorkspace = new Workspace('workspace-admin', 'Admin Workspace', 'user-1', 1, 2, 0, 1);
  const memberWorkspace = new Workspace(
    'workspace-member',
    'Member Workspace',
    'user-2',
    3,
    1,
    0,
    1,
  );

  const service = makeService(
    new Map([
      [adminWorkspace.id, adminWorkspace],
      [memberWorkspace.id, memberWorkspace],
    ]),
    workspaceUsers,
    async (userId: string) => {
      if (userId === 'user-1') {
        return [adminWorkspace, memberWorkspace];
      }
      return [];
    },
  );

  const summaries = await service.listWorkspaces('user-1');
  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].id, adminWorkspace.id);
  assert.equal(summaries[0].userCount, 1);
  assert.equal(summaries[0].serviceCount, 2);
  assert.equal(summaries[1].id, memberWorkspace.id);
  assert.equal(summaries[1].userCount, 3);
  assert.equal(summaries[1].serviceCount, 1);
});

test('createWorkspace returns workspace summary defaults for new workspace', async () => {
  const service = makeService(new Map());

  const createdWorkspace = await service.createWorkspace(
    'user-1',
    '  New Workspace ',
  );

  assert.equal(createdWorkspace.name, 'New Workspace');
  assert.equal(createdWorkspace.userCount, 1);
  assert.equal(createdWorkspace.serviceCount, 0);
  assert.equal(createdWorkspace.ownerCount, 0);
  assert.equal(createdWorkspace.environmentCount, 0);
});

test('listWorkspacePopupRows returns user rows with email for users', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setMember('workspace-1', 'user-1');

  const serviceRepository = new FakeServiceRepository(
    new Map([
      [
        'workspace-1',
        [
          { userId: 'user-a', email: 'alice@example.com' },
          { userId: 'user-b', email: 'bob@example.com' },
        ],
      ],
    ]),
  );

  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'admin-user', 2, 0, 0, 0)],
    ]),
    workspaceUsers,
    undefined,
    new Map([
      [
        'workspace-1',
        [
          { userId: 'user-a', email: 'alice@example.com' },
          { userId: 'user-b', email: 'bob@example.com' },
        ],
      ],
    ]),
    serviceRepository,
  );

  const rows = await service.listWorkspacePopupRows(
    'workspace-1',
    'user-1',
    'users',
  );

  assert.deepEqual(rows, [{ name: 'alice@example.com' }, { name: 'bob@example.com' }]);
  assert.deepEqual(rows.map(extractPopupRowName), ['alice@example.com', 'bob@example.com']);
});

test('listWorkspacePopupRows returns service name rows for services', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setMember('workspace-1', 'user-1');

  const serviceRepository = new FakeServiceRepository(
    undefined,
    new Map([
      [
        'workspace-1',
        [
          { serviceId: 'service-a', label: 'Auth API' },
          { serviceId: 'service-b', label: 'Billing' },
        ],
      ],
    ]),
  );

  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'admin-user', 0, 2, 0, 0)],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const rows = await service.listWorkspacePopupRows(
    'workspace-1',
    'user-1',
    'services',
  );

  assert.deepEqual(rows, [{ name: 'Auth API' }, { name: 'Billing' }]);
  assert.deepEqual(rows.map(extractPopupRowName), ['Auth API', 'Billing']);
});

test('listWorkspacePopupRows returns owner name rows for owners', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setMember('workspace-1', 'user-1');

  const serviceRepository = new FakeServiceRepository(
    undefined,
    undefined,
    new Map([
      [
        'workspace-1',
        [
          { ownerId: 'owner-a', name: 'Acme Team' },
          { ownerId: 'owner-b', name: 'Team B' },
        ],
      ],
    ]),
  );

  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'admin-user', 0, 0, 2, 0)],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const rows = await service.listWorkspacePopupRows(
    'workspace-1',
    'user-1',
    'owners',
  );

  assert.deepEqual(rows, [{ name: 'Acme Team' }, { name: 'Team B' }]);
  assert.deepEqual(rows.map(extractPopupRowName), ['Acme Team', 'Team B']);
});

test('listWorkspacePopupRows returns environment name rows for environments', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setMember('workspace-1', 'user-1');

  const serviceRepository = new FakeServiceRepository(
    undefined,
    undefined,
    undefined,
    new Map([
      [
        'workspace-1',
        [
          { environmentId: 'environment-a', environmentName: 'Dev' },
          { environmentId: 'environment-b', environmentName: 'Prod' },
        ],
      ],
    ]),
  );

  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'admin-user', 0, 0, 0, 2)],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const rows = await service.listWorkspacePopupRows(
    'workspace-1',
    'user-1',
    'environments',
  );

  assert.deepEqual(rows, [{ name: 'Dev' }, { name: 'Prod' }]);
  assert.deepEqual(rows.map(extractPopupRowName), ['Dev', 'Prod']);
});

test('listWorkspacePopupRows enforces membership authorization before returning rows', async () => {
  const serviceRepository = new FakeServiceRepository(
    new Map([
      [
        'workspace-1',
        [
          { userId: 'admin-user', email: 'admin@example.com' },
          { userId: 'some-member', email: 'member@example.com' },
        ],
      ],
    ]),
    new Map([
      [
        'workspace-1',
        [
          { serviceId: 'service-a', label: 'Service A' },
          { serviceId: 'service-b', label: 'Service B' },
        ],
      ],
    ]),
    new Map([
      [
        'workspace-1',
        [
          { ownerId: 'owner-a', name: 'Owner A' },
          { ownerId: 'owner-b', name: 'Owner B' },
        ],
      ],
    ]),
    new Map([
      [
        'workspace-1',
        [
          { environmentId: 'environment-a', environmentName: 'Env A' },
          { environmentId: 'environment-b', environmentName: 'Env B' },
        ],
      ],
    ]),
  );
  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0)],
    ]),
    new FakeWorkspaceUserRepository(),
    undefined,
    undefined,
    serviceRepository,
  );

  for (const resourceType of ['users', 'services', 'owners', 'environments'] as const) {
    await assert.rejects(
      () => service.listWorkspacePopupRows('workspace-1', 'user-2', resourceType),
      /Not authorized for workspace/,
    );
  }

  assert.equal(serviceRepository.listCalls.users, 0);
  assert.equal(serviceRepository.listCalls.services, 0);
  assert.equal(serviceRepository.listCalls.owners, 0);
  assert.equal(serviceRepository.listCalls.environments, 0);
});
