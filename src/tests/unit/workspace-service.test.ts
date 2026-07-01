import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../../services/WorkspaceService';
import { Workspace } from '../../entities/Workspace';
import { WorkspaceInvitation } from '../../entities/WorkspaceInvitation';

type WorkspaceRole = 'admin' | 'manager' | 'member';

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
      Array<{ userId: string; email: string; role?: WorkspaceRole }>
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
    return (this.workspaceUsers.get(workspaceId) || []).map((user) => ({
      userId: user.userId,
      email: user.email,
    }));
  }

  async listUsersByWorkspaceWithRole(
    workspaceId: string,
  ): Promise<Array<{ userId: string; email: string; role: WorkspaceRole }>> {
    return (this.workspaceUsers.get(workspaceId) || []).map((user) => ({
      userId: user.userId,
      email: user.email,
      role: user.role || 'member',
    }));
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
  private readonly memberships = new Map<string, WorkspaceRole>();

  withConnection(): FakeWorkspaceUserRepository {
    return this;
  }

  private makeKey(workspaceId: string, userId: string): string {
    return `${workspaceId}:${userId}`;
  }

  private setRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): void {
    this.memberships.set(this.makeKey(workspaceId, userId), role);
  }

  setAdmin(workspaceId: string, userId: string): void {
    this.setRole(workspaceId, userId, 'admin');
  }

  setManager(workspaceId: string, userId: string): void {
    this.setRole(workspaceId, userId, 'manager');
  }

  setMember(workspaceId: string, userId: string): void {
    this.setRole(workspaceId, userId, 'member');
  }

  async getRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | null> {
    return this.memberships.get(this.makeKey(workspaceId, userId)) || null;
  }

  async insert(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole = 'member',
  ): Promise<void> {
    this.setRole(workspaceId, userId, role);
    return undefined;
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    this.setRole(workspaceId, userId, role);
    return undefined;
  }

  async remove(workspaceId: string, userId: string): Promise<boolean> {
    return this.memberships.delete(this.makeKey(workspaceId, userId));
  }

  async countAdmins(workspaceId: string): Promise<number> {
    let count = 0;
    for (const [key, role] of this.memberships) {
      if (key.startsWith(`${workspaceId}:`) && role === 'admin') {
        count += 1;
      }
    }
    return count;
  }

  async isAdmin(workspaceId: string, userId: string): Promise<boolean> {
    return this.memberships.get(this.makeKey(workspaceId, userId)) === 'admin';
  }

  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    return this.memberships.has(this.makeKey(workspaceId, userId));
  }
}

class FakeServiceRepository {
  private readonly listCallCount = {
    users: 0,
    services: 0,
    owners: 0,
    environments: 0,
  };

  private readonly environments = new Map<
    string,
    Map<string, { id: string; name: string }>
  >();
  private readonly serviceEnvironmentAssociations = new Map<
    string,
    Set<string>
  >();
  private readonly owners = new Map<
    string,
    Map<string, { id: string; name: string }>
  >();
  private readonly services = new Map<
    string,
    {
      workspaceId: string;
      label: string;
      defaultMinutes: number;
      ownerId: string | null;
    }
  >();

  constructor(
    private readonly userRows = new Map<
      string,
      Array<{ userId: string; email: string }>
    >(),
    private readonly serviceRows = new Map<
      string,
      Array<{ serviceId: string; label: string }>
    >(),
    private readonly ownerRows = new Map<
      string,
      Array<{ ownerId: string; name: string }>
    >(),
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

  async findEnvironmentByName(
    workspaceId: string,
    name: string,
  ): Promise<{ environmentId: string } | null> {
    const workspaceEnvs = this.environments.get(workspaceId);
    const match = workspaceEnvs?.get(name.toLowerCase());
    return match ? { environmentId: match.id } : null;
  }

  async findEnvironmentByWorkspaceAndNames(
    workspaceId: string,
    names: string[],
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    const workspaceEnvs = this.environments.get(workspaceId);
    if (!workspaceEnvs || !names.length) {
      return [];
    }
    return names
      .map((name) => workspaceEnvs.get(name.toLowerCase()))
      .filter((entry): entry is { id: string; name: string } => Boolean(entry))
      .map((entry) => ({
        environmentId: entry.id,
        environmentName: entry.name,
      }));
  }

  async insertEnvironment(input: {
    workspaceId: string;
    environmentId: string;
    name: string;
  }): Promise<string> {
    const workspaceEnvs =
      this.environments.get(input.workspaceId) ??
      new Map<string, { id: string; name: string }>();
    workspaceEnvs.set(input.name.toLowerCase(), {
      id: input.environmentId,
      name: input.name,
    });
    this.environments.set(input.workspaceId, workspaceEnvs);
    return input.environmentId;
  }

  async findOwnerByWorkspaceAndName(
    workspaceId: string,
    name: string,
  ): Promise<{ ownerId: string } | null> {
    const workspaceOwners = this.owners.get(workspaceId);
    const match = workspaceOwners?.get(name.toLowerCase());
    return match ? { ownerId: match.id } : null;
  }

  async insertOwner(input: {
    workspaceId: string;
    ownerId: string;
    name: string;
  }): Promise<string> {
    const workspaceOwners =
      this.owners.get(input.workspaceId) ??
      new Map<string, { id: string; name: string }>();
    workspaceOwners.set(input.name.toLowerCase(), {
      id: input.ownerId,
      name: input.name,
    });
    this.owners.set(input.workspaceId, workspaceOwners);
    return input.ownerId;
  }

  async insertService(input: {
    workspaceId: string;
    serviceId: string;
    label: string;
    defaultMinutes: number;
    ownerId: string | null;
  }): Promise<string> {
    this.services.set(input.serviceId, {
      workspaceId: input.workspaceId,
      label: input.label,
      defaultMinutes: input.defaultMinutes,
      ownerId: input.ownerId,
    });
    return input.serviceId;
  }

  async findServiceIdForOwner(ownerId: string): Promise<string | null> {
    for (const [serviceId, service] of this.services.entries()) {
      if (service.ownerId === ownerId) {
        return serviceId;
      }
    }
    return null;
  }

  async findServiceByWorkspaceAndId(
    workspaceId: string,
    serviceId: string,
  ): Promise<{
    serviceId: string;
    workspaceId: string;
    label: string;
    defaultMinutes: number;
    ownerId: string | null;
  } | null> {
    const row = this.services.get(serviceId);
    if (!row || row.workspaceId !== workspaceId) {
      return null;
    }
    return {
      serviceId,
      workspaceId: row.workspaceId,
      label: row.label,
      defaultMinutes: row.defaultMinutes,
      ownerId: row.ownerId,
    };
  }

  async deleteServiceByWorkspaceAndId(
    workspaceId: string,
    serviceId: string,
  ): Promise<number> {
    const row = this.services.get(serviceId);
    if (!row || row.workspaceId !== workspaceId) {
      return 0;
    }
    this.services.delete(serviceId);
    return 1;
  }

  async isWorkspaceOwnerOwnedByWorkspace(): Promise<boolean> {
    return true;
  }

  async updateServiceMetadata(): Promise<void> {
    return undefined;
  }

  async getEnvironmentById(): Promise<boolean> {
    return true;
  }

  async insertServiceEnvironment(input: {
    serviceId: string;
    environmentId: string;
    serviceKey?: string;
  }): Promise<void> {
    const serviceEnvironmentIds =
      this.serviceEnvironmentAssociations.get(input.serviceId) ??
      new Set<string>();
    serviceEnvironmentIds.add(input.environmentId);
    this.serviceEnvironmentAssociations.set(
      input.serviceId,
      serviceEnvironmentIds,
    );
    return undefined;
  }

  async deleteOwnerByWorkspaceAndId(
    workspaceId: string,
    ownerId: string,
  ): Promise<number> {
    const workspaceOwners = this.owners.get(workspaceId);
    if (!workspaceOwners) {
      return 0;
    }

    for (const [name, owner] of workspaceOwners.entries()) {
      if (owner.id === ownerId) {
        workspaceOwners.delete(name);
        return 1;
      }
    }

    return 0;
  }

  async detachOwnerFromWorkspaceServices(
    workspaceId: string,
    ownerId: string,
  ): Promise<number> {
    let affected = 0;
    for (const service of this.services.values()) {
      if (service.workspaceId === workspaceId && service.ownerId === ownerId) {
        service.ownerId = null;
        affected += 1;
      }
    }
    return affected;
  }

  getServiceEnvironmentIds(serviceId: string): string[] {
    const ids = this.serviceEnvironmentAssociations.get(serviceId);
    return ids ? [...ids] : [];
  }

  async deleteEnvironmentByWorkspaceAndId(
    workspaceId: string,
    environmentId: string,
  ): Promise<number> {
    const workspaceEnvironments = this.environments.get(workspaceId);
    if (!workspaceEnvironments) {
      return 0;
    }

    for (const [name, entry] of workspaceEnvironments.entries()) {
      if (entry.id !== environmentId) {
        continue;
      }
      workspaceEnvironments.delete(name);
      return 1;
    }

    return 0;
  }

  async deleteServiceEnvironmentAssociationsForEnvironment(
    workspaceId: string,
    environmentId: string,
  ): Promise<number> {
    let affected = 0;

    for (const [
      serviceId,
      associations,
    ] of this.serviceEnvironmentAssociations.entries()) {
      const service = this.services.get(serviceId);
      if (!service || service.workspaceId !== workspaceId) {
        continue;
      }
      if (associations.delete(environmentId)) {
        affected += 1;
      }
    }

    return affected;
  }

  async deleteServiceEnvironmentAssociationsNotIn(): Promise<void> {
    return undefined;
  }
}

class FakeInvitationRepository {
  private readonly insertErrorsByCall: Record<number, { code: string }>;
  private readonly rows: Array<{
    invitationId: string;
    workspaceId: string;
    invitedUserId: string | null;
    invitedByUserId: string;
    status: 'pending' | 'accepted' | 'revoked';
    invitedEmail: string;
    invitationCodeHash: string;
    expiresAt: Date;
    createdAt: Date;
    acceptedAt: Date | null;
    consumedAt: Date | null;
  }>;
  private readonly existingRows: Array<{
    invitationId: string;
    workspaceId: string;
    invitedUserId: string | null;
    invitedByUserId: string;
    status: 'pending' | 'accepted' | 'revoked';
    invitedEmail: string;
    invitationCodeHash: string;
    expiresAt: Date;
    createdAt: Date;
    acceptedAt: Date | null;
    consumedAt: Date | null;
  }> = [];
  private insertCount = 0;
  private nextId = 1;

  constructor(
    existingRows: Array<{
      workspaceId: string;
      invitedUserId?: string | null;
      invitedByUserId: string;
      status?: 'pending' | 'accepted' | 'revoked';
      invitedEmail?: string;
      invitationCodeHash?: string;
      expiresAt?: Date;
      createdAt?: Date;
      acceptedAt?: Date | null;
      consumedAt?: Date | null;
    }> = [],
    insertErrorsByCall: Record<number, { code: string }> = {},
  ) {
    this.insertErrorsByCall = insertErrorsByCall;
    this.rows = [];
    this.existingRows = existingRows.map((row) => ({
      invitationId: `seed-${this.nextId++}`,
      workspaceId: row.workspaceId,
      invitedUserId: row.invitedUserId ?? null,
      invitedByUserId: row.invitedByUserId,
      status: row.status || 'pending',
      invitedEmail: (row.invitedEmail || '').trim().toLowerCase(),
      invitationCodeHash: row.invitationCodeHash || `seed-hash-${this.nextId}`,
      expiresAt: row.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: row.createdAt || new Date(),
      acceptedAt: row.acceptedAt || null,
      consumedAt: row.consumedAt || null,
    }));
    this.insertCount = 0;
  }

  withConnection(): FakeInvitationRepository {
    return this;
  }

  async insert(
    invitationId: string,
    workspaceId: string,
    invitedUserId: string | null,
    invitedByUserId: string,
    invitedEmail?: string,
    invitationCodeHash?: string,
    expiresAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000),
  ): Promise<WorkspaceInvitation> {
    this.insertCount += 1;
    const plannedError = this.insertErrorsByCall[this.insertCount];
    if (plannedError) {
      const error = new Error(plannedError.code || 'insert failed');
      (error as { code?: string }).code = plannedError.code;
      throw error;
    }

    const row = {
      invitationId,
      workspaceId,
      invitedUserId,
      invitedByUserId,
      status: 'pending' as const,
      invitedEmail: (invitedEmail || '').trim().toLowerCase(),
      invitationCodeHash: invitationCodeHash || `insert-hash-${this.nextId++}`,
      expiresAt,
      createdAt: new Date(),
      acceptedAt: null,
      consumedAt: null,
    };
    this.rows.push(row);
    this.existingRows.push(row);

    return new WorkspaceInvitation(
      invitationId,
      workspaceId,
      invitedUserId,
      invitedByUserId,
      'pending',
      row.createdAt,
      row.invitedEmail,
      row.invitationCodeHash,
      row.expiresAt,
      row.acceptedAt,
      row.consumedAt,
    );
  }

  async getByWorkspaceUser(
    workspaceId: string,
    userId: string,
  ): Promise<{
    invitation_id: string;
    workspace_id: string;
    invited_user_id: string | null;
    invited_by_user_id: string;
    status: 'pending' | 'accepted' | 'revoked';
    created_at: Date;
    invited_email?: string;
    expires_at?: Date;
  } | null> {
    const found = [...this.existingRows, ...this.rows].find(
      (row) => row.workspaceId === workspaceId && row.invitedUserId === userId,
    );
    if (!found) {
      return null;
    }
    return {
      invitation_id: found.invitationId,
      workspace_id: found.workspaceId,
      invited_user_id: found.invitedUserId,
      invited_by_user_id: found.invitedByUserId,
      status: found.status,
      created_at: found.createdAt,
      invited_email: found.invitedEmail,
      expires_at: found.expiresAt,
    };
  }

  async findLatestByWorkspaceAndEmail(
    workspaceId: string,
    invitedEmail: string,
  ): Promise<WorkspaceInvitation | null> {
    const normalizedEmail = invitedEmail.trim().toLowerCase();
    const invitation = [...this.existingRows, ...this.rows]
      .filter(
        (row) =>
          row.workspaceId === workspaceId &&
          row.invitedEmail === normalizedEmail,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return invitation ? this.toEntity(invitation) : null;
  }

  async findLatestByCodeHash(
    invitationCodeHash: string,
  ): Promise<WorkspaceInvitation | null> {
    const invitation = [...this.existingRows, ...this.rows]
      .filter((row) => row.invitationCodeHash === invitationCodeHash)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return invitation ? this.toEntity(invitation) : null;
  }

  async findLatestByCodeHashForUpdate(
    invitationCodeHash: string,
  ): Promise<WorkspaceInvitation | null> {
    return this.findLatestByCodeHash(invitationCodeHash);
  }

  async listPendingByWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceInvitation[]> {
    return [...this.existingRows, ...this.rows]
      .filter(
        (row) => row.workspaceId === workspaceId && row.status === 'pending',
      )
      .map((row) => this.toEntity(row));
  }

  async listExpiredByWorkspace(
    workspaceId: string,
    now: Date,
  ): Promise<WorkspaceInvitation[]> {
    return [...this.existingRows, ...this.rows]
      .filter(
        (row) =>
          row.workspaceId === workspaceId &&
          row.status === 'pending' &&
          row.expiresAt.getTime() <= now.getTime(),
      )
      .map((row) => this.toEntity(row));
  }

  async markAccepted(invitationId: string, now: Date): Promise<boolean> {
    const invitation = [...this.existingRows, ...this.rows].find(
      (row) => row.invitationId === invitationId,
    );
    if (!invitation) {
      return false;
    }
    invitation.status = 'accepted';
    invitation.acceptedAt = now;
    return true;
  }

  async markConsumed(invitationId: string, now: Date): Promise<boolean> {
    const invitation = [...this.existingRows, ...this.rows].find(
      (row) => row.invitationId === invitationId,
    );
    if (!invitation) {
      return false;
    }
    invitation.status = 'revoked';
    invitation.consumedAt = now;
    return true;
  }

  async markConsumedByWorkspace(
    workspaceId: string,
    invitationId: string,
    now: Date,
  ): Promise<boolean> {
    const invitation = [...this.existingRows, ...this.rows].find(
      (row) =>
        row.workspaceId === workspaceId && row.invitationId === invitationId,
    );
    if (!invitation || invitation.status !== 'pending') {
      return false;
    }
    invitation.status = 'revoked';
    invitation.consumedAt = now;
    return true;
  }

  async forceExpireInvitation(
    invitationCodeHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const invitation = [...this.existingRows, ...this.rows].find(
      (row) => row.invitationCodeHash === invitationCodeHash,
    );
    if (!invitation) {
      return false;
    }
    invitation.expiresAt = expiresAt;
    return true;
  }

  async forceStatusByCodeHash(
    invitationCodeHash: string,
    status: 'pending' | 'accepted' | 'revoked',
    at: Date,
  ): Promise<boolean> {
    const invitation = [...this.existingRows, ...this.rows].find(
      (row) => row.invitationCodeHash === invitationCodeHash,
    );
    if (!invitation) {
      return false;
    }
    invitation.status = status;
    if (status === 'accepted') {
      invitation.acceptedAt = at;
    }
    if (status === 'revoked') {
      invitation.consumedAt = at;
    }
    return true;
  }

  private toEntity(row: {
    invitationId: string;
    workspaceId: string;
    invitedUserId: string | null;
    invitedByUserId: string;
    status: 'pending' | 'accepted' | 'revoked';
    invitedEmail: string;
    invitationCodeHash: string;
    expiresAt: Date;
    createdAt: Date;
    acceptedAt: Date | null;
    consumedAt: Date | null;
  }): WorkspaceInvitation {
    return new WorkspaceInvitation(
      row.invitationId,
      row.workspaceId,
      row.invitedUserId,
      row.invitedByUserId,
      row.status,
      row.createdAt,
      row.invitedEmail,
      row.invitationCodeHash,
      row.expiresAt,
      row.acceptedAt,
      row.consumedAt,
    );
  }
}

class FakeUserRepository {
  private readonly emailMap: Map<
    string,
    { userId: string; activated: boolean; nickname: string }
  >;
  private readonly userById: Map<
    string,
    { userId: string; email: string; activated: boolean; nickname: string }
  >;

  constructor(
    source: Map<
      string,
      string | { userId: string; activated?: boolean; nickname?: string }
    > = new Map(),
  ) {
    this.emailMap = new Map();
    this.userById = new Map();
    for (const [email, value] of source.entries()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (typeof value === 'string') {
        const record = {
          userId: value,
          activated: false,
          nickname: normalizedEmail.split('@')[0] || 'user',
        };
        this.emailMap.set(normalizedEmail, record);
        this.userById.set(record.userId, {
          userId: record.userId,
          email: normalizedEmail,
          activated: record.activated,
          nickname: record.nickname,
        });
        continue;
      }

      const record = {
        userId: value.userId,
        activated: Boolean(value.activated),
        nickname: value.nickname || normalizedEmail.split('@')[0] || 'user',
      };
      this.emailMap.set(normalizedEmail, record);
      this.userById.set(record.userId, {
        userId: record.userId,
        email: normalizedEmail,
        activated: record.activated,
        nickname: record.nickname,
      });
    }
  }

  async findByEmail(email: string): Promise<{ userId: string } | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.emailMap.get(normalizedEmail);
    return user ? { userId: user.userId } : null;
  }

  async findByIds(ids: string[]): Promise<
    Array<{
      userId: string;
      email: string;
      nickname: string;
      activatedAt: Date | null;
      activated: boolean;
    }>
  > {
    const uniqueIds = [...new Set(ids)];
    const users = uniqueIds
      .map((id) => this.userById.get(id))
      .filter(
        (
          user,
        ): user is {
          userId: string;
          email: string;
          activated: boolean;
          nickname: string;
        } => user !== undefined,
      )
      .map((user) => ({
        userId: user.userId,
        email: user.email,
        nickname: user.nickname,
        activatedAt: user.activated ? new Date() : null,
        activated: user.activated,
      }));

    return users as Array<{
      userId: string;
      email: string;
      nickname: string;
      activatedAt: Date | null;
      activated: boolean;
    }>;
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
  workspaceUsersByWorkspace?: Map<
    string,
    Array<{ userId: string; email: string; role?: WorkspaceRole }>
  >,
  serviceRepository?: FakeServiceRepository,
  invitationRepository = new FakeInvitationRepository(),
  userRepository = new FakeUserRepository(
    new Map([['user@example.com', 'user-2']]),
  ),
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
    invitationRepository as never,
    userRepository as never,
    new FakeUserRoleRepository(new Set(['user-1'])) as never,
  );
}

function extractPopupRowName(row: { name: string }): string {
  return row.name;
}

type OwnerEnvironmentDeleteOps = {
  deleteOwner: (
    workspaceId: string,
    userId: string,
    ownerId: string,
  ) => Promise<unknown>;
  deleteEnvironment: (
    workspaceId: string,
    userId: string,
    environmentId: string,
  ) => Promise<unknown>;
};

function toOwnerEnvironmentDeleteOps(
  service: WorkspaceService,
): OwnerEnvironmentDeleteOps {
  const ops = service as unknown as OwnerEnvironmentDeleteOps;
  if (typeof ops.deleteOwner !== 'function') {
    assert.fail('WorkspaceService.deleteOwner is not implemented yet');
  }
  if (typeof ops.deleteEnvironment !== 'function') {
    assert.fail('WorkspaceService.deleteEnvironment is not implemented yet');
  }
  return ops;
}

type WorkspaceMembershipMutationService = {
  removeWorkspaceUser: (
    workspaceId: string,
    actorUserId: string,
    targetUserId: string,
  ) => Promise<unknown>;
  updateWorkspaceUserRole: (
    workspaceId: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
  ) => Promise<unknown>;
};

test('createService requires workspace admin', async () => {
  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
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

test('createService allows admin and allows manager role in workspace', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const adminCreated = await service.createService(
    'workspace-1',
    'admin-user',
    {
      environmentNames: ['Dev'],
      label: 'svc-admin',
      defaultMinutes: 10,
    },
  );
  const managerCreated = await service.createService(
    'workspace-1',
    'manager-user',
    {
      environmentNames: ['Ops'],
      label: 'svc-manager',
      defaultMinutes: 15,
    },
  );

  assert.equal(typeof adminCreated.serviceId, 'string');
  assert.equal(typeof managerCreated.serviceId, 'string');
  assert.equal(adminCreated.createdEnvironments, 1);
  assert.equal(managerCreated.createdEnvironments, 1);
});

test('createService requires workspace membership', async () => {
  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
    ]),
  );

  await assert.rejects(
    () =>
      service.createService('workspace-2', 'user-1', {
        environmentNames: ['Dev'],
        label: 'svc',
        defaultMinutes: 10,
      }),
    /Workspace not found/,
  );
});

test('createService requires at least one environment', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'user-1');
  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
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
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
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

test('updateService allows admin and manager roles in the workspace', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const created = await service.createService('workspace-1', 'admin-user', {
    environmentNames: ['Dev'],
    label: 'svc',
    defaultMinutes: 10,
  });

  const updated = await service.updateService('workspace-1', 'manager-user', {
    serviceId: created.serviceId,
    environmentNames: ['Dev'],
    label: 'svc-updated',
    defaultMinutes: 20,
  });

  assert.equal(updated.serviceId, created.serviceId);
});

test('deleteService allows admin and manager roles in the workspace', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const created = await service.createService('workspace-1', 'admin-user', {
    environmentNames: ['Dev'],
    label: 'svc',
    defaultMinutes: 10,
  });

  await service.deleteService('workspace-1', 'manager-user', created.serviceId);
  const role = await workspaceUsers.getRole('workspace-1', 'manager-user');
  assert.equal(role, 'manager');
});

test('createOwner and createEnvironment allow admin and manager roles', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const owner = await service.createOwner('workspace-1', 'manager-user', {
    name: 'Owner 1',
  });

  const env = await service.createEnvironment('workspace-1', 'manager-user', {
    name: 'Env 1',
  });

  assert.equal(typeof owner.ownerId, 'string');
  assert.equal(typeof env.environmentId, 'string');
});

test('deleteOwner allows admin and manager roles', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');

  const serviceRepository = new FakeServiceRepository();
  await serviceRepository.insertOwner({
    workspaceId: 'workspace-1',
    ownerId: 'owner-admin',
    name: 'Owner Admin',
  });
  await serviceRepository.insertOwner({
    workspaceId: 'workspace-1',
    ownerId: 'owner-manager',
    name: 'Owner Manager',
  });

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const deleteOps = toOwnerEnvironmentDeleteOps(service);
  await deleteOps.deleteOwner('workspace-1', 'admin-user', 'owner-admin');
  await deleteOps.deleteOwner('workspace-1', 'manager-user', 'owner-manager');
  const remainingOwners =
    await serviceRepository.listOwnersByWorkspace('workspace-1');
  assert.equal(remainingOwners.length, 0);
});

test('deleteOwner allows only admin and manager and rejects member and non-member users', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const serviceRepository = new FakeServiceRepository();
  await serviceRepository.insertOwner({
    workspaceId: 'workspace-1',
    ownerId: 'owner-1',
    name: 'Owner',
  });

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const deleteOps = toOwnerEnvironmentDeleteOps(service);

  await assert.rejects(
    () => deleteOps.deleteOwner('workspace-1', 'member-user', 'owner-1'),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () => deleteOps.deleteOwner('workspace-2', 'admin-user', 'owner-1'),
    /Workspace not found/,
  );

  await assert.rejects(
    () => deleteOps.deleteOwner('workspace-1', 'missing-user', 'owner-1'),
    /Not authorized|Not found|missing|workspace/,
  );
});

test('deleteOwner rejects missing owner in workspace', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );
  const deleteOps = toOwnerEnvironmentDeleteOps(service);

  await assert.rejects(
    () => deleteOps.deleteOwner('workspace-1', 'admin-user', 'missing-owner'),
    /Owner not found|not found|missing/,
  );
});

test('deleteOwner detaches owner from services without deleting services', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const serviceRepository = new FakeServiceRepository();
  await serviceRepository.insertOwner({
    workspaceId: 'workspace-1',
    ownerId: 'owner-1',
    name: 'Owner',
  });
  await serviceRepository.insertService({
    workspaceId: 'workspace-1',
    serviceId: 'service-1',
    label: 'Service',
    defaultMinutes: 15,
    ownerId: 'owner-1',
  });

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const deleteOps = toOwnerEnvironmentDeleteOps(service);
  await deleteOps.deleteOwner('workspace-1', 'admin-user', 'owner-1');

  const serviceRow = await serviceRepository.findServiceByWorkspaceAndId(
    'workspace-1',
    'service-1',
  );
  assert.ok(serviceRow);
  assert.equal(serviceRow?.ownerId, null);
});

test('deleteEnvironment allows admin and manager roles', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');

  const serviceRepository = new FakeServiceRepository();
  await serviceRepository.insertEnvironment({
    workspaceId: 'workspace-1',
    environmentId: 'environment-admin',
    name: 'Admin Env',
  });
  await serviceRepository.insertEnvironment({
    workspaceId: 'workspace-1',
    environmentId: 'environment-manager',
    name: 'Manager Env',
  });

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const deleteOps = toOwnerEnvironmentDeleteOps(service);
  await deleteOps.deleteEnvironment(
    'workspace-1',
    'admin-user',
    'environment-admin',
  );
  await deleteOps.deleteEnvironment(
    'workspace-1',
    'manager-user',
    'environment-manager',
  );
  const remaining =
    await serviceRepository.listEnvironmentsByWorkspace('workspace-1');
  assert.equal(remaining.length, 0);
});

test('deleteEnvironment allows only admin and manager and rejects member and non-member users', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const serviceRepository = new FakeServiceRepository();
  await serviceRepository.insertEnvironment({
    workspaceId: 'workspace-1',
    environmentId: 'environment-1',
    name: 'Env',
  });

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const deleteOps = toOwnerEnvironmentDeleteOps(service);
  await assert.rejects(
    () =>
      deleteOps.deleteEnvironment(
        'workspace-1',
        'member-user',
        'environment-1',
      ),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () =>
      deleteOps.deleteEnvironment('workspace-2', 'admin-user', 'environment-1'),
    /Workspace not found/,
  );

  await assert.rejects(
    () =>
      deleteOps.deleteEnvironment(
        'workspace-1',
        'missing-user',
        'environment-1',
      ),
    /Not authorized for workspace|not found|missing/,
  );
});

test('deleteEnvironment rejects missing environment in workspace', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const deleteOps = toOwnerEnvironmentDeleteOps(service);
  await assert.rejects(
    () =>
      deleteOps.deleteEnvironment('workspace-1', 'admin-user', 'missing-env'),
    /Environment not found|not found|missing/,
  );
});

test('deleteEnvironment removes matching service environment associations and preserves services', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const serviceRepository = new FakeServiceRepository();
  await serviceRepository.insertEnvironment({
    workspaceId: 'workspace-1',
    environmentId: 'environment-keep',
    name: 'Keep',
  });
  await serviceRepository.insertEnvironment({
    workspaceId: 'workspace-1',
    environmentId: 'environment-remove',
    name: 'Remove',
  });

  await serviceRepository.insertService({
    workspaceId: 'workspace-1',
    serviceId: 'service-1',
    label: 'Service',
    defaultMinutes: 15,
    ownerId: null,
  });
  await serviceRepository.insertService({
    workspaceId: 'workspace-1',
    serviceId: 'service-2',
    label: 'Service-two',
    defaultMinutes: 20,
    ownerId: null,
  });

  await serviceRepository.insertServiceEnvironment({
    serviceId: 'service-1',
    environmentId: 'environment-keep',
  });
  await serviceRepository.insertServiceEnvironment({
    serviceId: 'service-1',
    environmentId: 'environment-remove',
  });
  await serviceRepository.insertServiceEnvironment({
    serviceId: 'service-2',
    environmentId: 'environment-remove',
  });

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    serviceRepository,
  );

  const deleteOps = toOwnerEnvironmentDeleteOps(service);
  await deleteOps.deleteEnvironment(
    'workspace-1',
    'admin-user',
    'environment-remove',
  );

  const serviceOne = await serviceRepository.findServiceByWorkspaceAndId(
    'workspace-1',
    'service-1',
  );
  const serviceTwo = await serviceRepository.findServiceByWorkspaceAndId(
    'workspace-1',
    'service-2',
  );

  assert.ok(serviceOne);
  assert.ok(serviceTwo);
  assert.deepEqual(serviceRepository.getServiceEnvironmentIds('service-1'), [
    'environment-keep',
  ]);
  assert.deepEqual(serviceRepository.getServiceEnvironmentIds('service-2'), []);
});

test('resource administration denies member role and allows admin/manager', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const adminCreated = await service.createService(
    'workspace-1',
    'admin-user',
    {
      environmentNames: ['Dev'],
      label: 'svc-admin',
      defaultMinutes: 10,
    },
  );
  const managerCreated = await service.createService(
    'workspace-1',
    'manager-user',
    {
      environmentNames: ['Ops'],
      label: 'svc-manager',
      defaultMinutes: 12,
    },
  );
  const createOwnerManager = await service.createOwner(
    'workspace-1',
    'manager-user',
    {
      name: 'Owner 2',
    },
  );
  const createEnvManager = await service.createEnvironment(
    'workspace-1',
    'manager-user',
    {
      name: 'Env 2',
    },
  );

  assert.equal(typeof adminCreated.serviceId, 'string');
  assert.equal(typeof managerCreated.serviceId, 'string');
  assert.equal(typeof createOwnerManager.ownerId, 'string');
  assert.equal(typeof createEnvManager.environmentId, 'string');

  await service.updateService('workspace-1', 'manager-user', {
    serviceId: managerCreated.serviceId,
    environmentIds: ['environment-manual'],
    label: 'svc-manager-updated',
    defaultMinutes: 20,
  });

  await assert.rejects(
    () =>
      service.createService('workspace-1', 'member-user', {
        environmentNames: ['Member'],
        label: 'forbidden',
        defaultMinutes: 10,
      }),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () =>
      service.updateService('workspace-1', 'member-user', {
        serviceId: managerCreated.serviceId,
        environmentNames: ['Ops'],
        label: 'forbidden',
        defaultMinutes: 15,
      }),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () =>
      service.createOwner('workspace-1', 'member-user', { name: 'Owner X' }),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () =>
      service.createEnvironment('workspace-1', 'member-user', {
        name: 'Environment X',
      }),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () =>
      service.deleteService(
        'workspace-1',
        'member-user',
        adminCreated.serviceId,
      ),
    /Not authorized for workspace/,
  );
});

test('inviteUser allows admin and manager and denies member', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const adminInvite = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'admin-invite@example.com',
  );
  const managerInvite = await service.inviteUser(
    'workspace-1',
    'manager-user',
    'manager-invite@example.com',
  );

  assert.ok(adminInvite.invitationCode);
  assert.ok(managerInvite.invitationCode);

  await assert.rejects(
    () =>
      service.inviteUser(
        'workspace-1',
        'member-user',
        'member-invite@example.com',
      ),
    /Not authorized for workspace/,
  );
});

test('removePendingInvitation allows admin and manager and denies member', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');
  workspaceUsers.setMember('workspace-1', 'member-user');
  const invitationRepository = new FakeInvitationRepository();

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    invitationRepository,
    new FakeUserRepository(new Map()),
  );

  const adminInvitation = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'admin-remove@example.com',
  );
  const managerInvitation = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'manager-remove@example.com',
  );
  const memberInvitation = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'member-denied@example.com',
  );

  await service.removePendingInvitation(
    'workspace-1',
    'admin-user',
    adminInvitation.invitationId,
  );
  await service.removePendingInvitation(
    'workspace-1',
    'manager-user',
    managerInvitation.invitationId,
  );

  await assert.rejects(
    () =>
      service.removePendingInvitation(
        'workspace-1',
        'member-user',
        memberInvitation.invitationId,
      ),
    /Not authorized for workspace/,
  );

  const pendingRows =
    await invitationRepository.listPendingByWorkspace('workspace-1');
  const pendingEmails = new Set(pendingRows.map((row) => row.invitedEmail));
  assert.equal(pendingEmails.has('admin-remove@example.com'), false);
  assert.equal(pendingEmails.has('manager-remove@example.com'), false);
  assert.equal(pendingEmails.has('member-denied@example.com'), true);
});

test('removePendingInvitation rejects invitations outside the workspace', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setAdmin('workspace-2', 'admin-user');
  const invitationRepository = new FakeInvitationRepository();

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
      [
        'workspace-2',
        new Workspace('workspace-2', 'B', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    invitationRepository,
    new FakeUserRepository(new Map()),
  );

  const invitation = await service.inviteUser(
    'workspace-2',
    'admin-user',
    'other-workspace@example.com',
  );

  await assert.rejects(
    () =>
      service.removePendingInvitation(
        'workspace-1',
        'admin-user',
        invitation.invitationId,
      ),
    /Workspace invitation not found/,
  );

  const pendingRows =
    await invitationRepository.listPendingByWorkspace('workspace-2');
  assert.equal(
    pendingRows.some(
      (row) => row.invitedEmail === 'other-workspace@example.com',
    ),
    true,
  );
});

test('inviteUser rejects invalid invite email', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  await assert.rejects(
    () => service.inviteUser('workspace-1', 'admin-user', 'not-an-email'),
    /Invalid invitee email/,
  );

  await assert.rejects(
    () => service.inviteUser('workspace-1', 'admin-user', '   '),
    /Invalid invitee email/,
  );
});

test('inviteUser allows unregistered email invitations', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    undefined,
    new FakeUserRepository(new Map()),
  );

  const issued = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'new-person@example.com',
  );
  assert.equal(issued.invitedUserId, null);
  assert.equal(issued.invitedEmail, 'new-person@example.com');
});

test('inviteUser rejects duplicate pending invitations but allows expired reinvite', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const now = new Date();
  const invitationRepository = new FakeInvitationRepository([
    {
      workspaceId: 'workspace-1',
      invitedByUserId: 'admin-user',
      invitedUserId: 'user-2',
      invitedEmail: 'user@example.com',
      status: 'pending',
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 60000),
    },
  ]);

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    invitationRepository,
    new FakeUserRepository(new Map([['user@example.com', 'user-2']])),
  );

  await assert.rejects(
    () => service.inviteUser('workspace-1', 'admin-user', 'user@example.com'),
    /Invitation already pending/,
  );

  const expiredRepository = new FakeInvitationRepository([
    {
      workspaceId: 'workspace-1',
      invitedByUserId: 'admin-user',
      invitedUserId: 'user-2',
      invitedEmail: 'user2@example.com',
      status: 'pending',
      expiresAt: new Date(now.getTime() - 1000),
      createdAt: new Date(now.getTime() - 120000),
    },
  ]);
  const expiredService = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    expiredRepository,
    new FakeUserRepository(new Map([['user2@example.com', 'user-2']])),
  );

  const reinvite = await expiredService.inviteUser(
    'workspace-1',
    'admin-user',
    'user2@example.com',
  );
  assert.ok(reinvite.invitationCode);
});

test('user removal enforces admin-only and workspace single-admin invariant', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  ) as never as WorkspaceMembershipMutationService;

  await service.removeWorkspaceUser('workspace-1', 'admin-user', 'member-user');
  const isMemberRemoved = await workspaceUsers.isMember(
    'workspace-1',
    'member-user',
  );
  assert.equal(isMemberRemoved, false);

  await assert.rejects(
    () =>
      service.removeWorkspaceUser('workspace-1', 'manager-user', 'member-user'),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () =>
      service.removeWorkspaceUser('workspace-1', 'member-user', 'manager-user'),
    /Not authorized for workspace/,
  );

  await assert.rejects(
    () =>
      service.removeWorkspaceUser('workspace-1', 'admin-user', 'missing-user'),
    /Workspace user not found/,
  );

  workspaceUsers.setAdmin('workspace-2', 'solo-admin');
  const soloWorkspaceService = makeService(
    new Map([
      [
        'workspace-2',
        new Workspace('workspace-2', 'Solo', 'solo-admin', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  ) as never as WorkspaceMembershipMutationService;

  await assert.rejects(
    () =>
      soloWorkspaceService.removeWorkspaceUser(
        'workspace-2',
        'solo-admin',
        'solo-admin',
      ),
    /Workspace owner cannot remove own membership/,
  );

  await assert.rejects(
    () =>
      service.removeWorkspaceUser('workspace-2', 'admin-user', 'manager-user'),
    /Workspace not found/,
  );
});

test('user role updates enforce admin-only, validate roles, and preserve single-admin', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'manager-user');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  ) as never as WorkspaceMembershipMutationService;

  await service.updateWorkspaceUserRole(
    'workspace-1',
    'admin-user',
    'manager-user',
    'member',
  );
  assert.equal(
    await workspaceUsers.getRole('workspace-1', 'manager-user'),
    'member',
  );

  await assert.rejects(
    () =>
      service.updateWorkspaceUserRole(
        'workspace-1',
        'admin-user',
        'member-user',
        'admin',
      ),
    /Workspace already has an admin/,
  );

  await assert.rejects(
    () =>
      service.updateWorkspaceUserRole(
        'workspace-1',
        'admin-user',
        'member-user',
        'superuser',
      ),
    /Invalid workspace role/,
  );

  await assert.rejects(
    () =>
      service.updateWorkspaceUserRole(
        'workspace-1',
        'manager-user',
        'member-user',
        'member',
      ),
    /Not authorized for workspace/,
  );

  await service.updateWorkspaceUserRole(
    'workspace-1',
    'admin-user',
    'admin-user',
    'admin',
  );
  assert.equal(
    await workspaceUsers.getRole('workspace-1', 'admin-user'),
    'admin',
  );

  const singleAdminService = makeService(
    new Map([
      [
        'workspace-2',
        new Workspace('workspace-2', 'B', 'solo-admin', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  ) as never as WorkspaceMembershipMutationService;
  workspaceUsers.setAdmin('workspace-2', 'solo-admin');

  await assert.rejects(
    () =>
      singleAdminService.updateWorkspaceUserRole(
        'workspace-2',
        'solo-admin',
        'solo-admin',
        'member',
      ),
    /Workspace owner cannot change own role/,
  );
});

test('workspace owner cannot remove or demote their own membership when another admin exists', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'owner-user');
  workspaceUsers.setAdmin('workspace-1', 'other-admin');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'owner-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  ) as never as WorkspaceMembershipMutationService;

  await assert.rejects(
    () =>
      service.updateWorkspaceUserRole(
        'workspace-1',
        'owner-user',
        'owner-user',
        'member',
      ),
    /Workspace owner cannot change own role/,
  );
  assert.equal(
    await workspaceUsers.getRole('workspace-1', 'owner-user'),
    'admin',
  );

  await assert.rejects(
    () =>
      service.removeWorkspaceUser('workspace-1', 'owner-user', 'owner-user'),
    /Workspace owner cannot remove own membership/,
  );
  assert.equal(
    await workspaceUsers.getRole('workspace-1', 'owner-user'),
    'admin',
  );

  await service.removeWorkspaceUser('workspace-1', 'owner-user', 'member-user');
  assert.equal(
    await workspaceUsers.getRole('workspace-1', 'member-user'),
    null,
  );
});

test('role updates only affect target workspace membership', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setAdmin('workspace-2', 'admin-user');
  workspaceUsers.setManager('workspace-1', 'target-user');
  workspaceUsers.setMember('workspace-2', 'target-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
      [
        'workspace-2',
        new Workspace('workspace-2', 'B', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  ) as never as WorkspaceMembershipMutationService;

  await service.updateWorkspaceUserRole(
    'workspace-1',
    'admin-user',
    'target-user',
    'member',
  );

  assert.equal(
    await workspaceUsers.getRole('workspace-1', 'target-user'),
    'member',
  );
  assert.equal(
    await workspaceUsers.getRole('workspace-2', 'target-user'),
    'member',
  );
});

test('updateWorkspaceUserRole fails with missing workspace or missing membership', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  workspaceUsers.setMember('workspace-1', 'member-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  ) as never as WorkspaceMembershipMutationService;

  await assert.rejects(
    () =>
      service.updateWorkspaceUserRole(
        'workspace-2',
        'admin-user',
        'member-user',
        'manager',
      ),
    /Workspace not found/,
  );

  await assert.rejects(
    () =>
      service.updateWorkspaceUserRole(
        'workspace-1',
        'admin-user',
        'missing-user',
        'manager',
      ),
    /Workspace user not found/,
  );
});

test('updateService requires nonblank label', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'user-1');
  const service = makeService(
    new Map([
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
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
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
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
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
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
      ['workspace-1', new Workspace('workspace-1', 'A', 'user-1', 1, 0, 0, 0)],
    ]),
    workspaceUsers,
  );

  await assert.rejects(
    () => service.inviteUser('workspace-1', 'user-1', 'user@example.com'),
    /User already in workspace/,
  );
});

test('validateWorkspaceInvitationCode handles invalid invitation codes', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
  );

  const invalid = await service.validateWorkspaceInvitationCode('');
  assert.equal(invalid.status, 'invalid');
  assert.equal(invalid.invitation, null);
  assert.equal(invalid.existingUserInvite, false);
});

test('validateWorkspaceInvitationCode handles unregistered, wrong-user, and valid invitation codes', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const userRepository = new FakeUserRepository(
    new Map([
      ['registered@example.com', { userId: 'user-2', activated: true }],
    ]),
  );

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    new FakeInvitationRepository(),
    userRepository,
  );

  const unregistered = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'newperson@example.com',
  );
  const unregisteredValidation = await service.validateWorkspaceInvitationCode(
    unregistered.invitationCode,
  );
  assert.equal(unregisteredValidation.status, 'unregistered');
  assert.equal(
    unregisteredValidation.invitation?.invitedEmail,
    'newperson@example.com',
  );

  const registered = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'registered@example.com',
  );
  const wrongUserValidation = await service.validateWorkspaceInvitationCode(
    registered.invitationCode,
    'wrong-user',
  );
  assert.equal(wrongUserValidation.status, 'wrong_user');
  assert.equal(wrongUserValidation.existingUserInvite, true);

  const valid = await service.validateWorkspaceInvitationCode(
    registered.invitationCode,
    'user-2',
  );
  assert.equal(valid.status, 'valid');
  assert.equal(valid.invitation?.invitedUserId, 'user-2');
});

test('validateWorkspaceInvitationCode handles expired invitation codes', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const invitationRepository = new FakeInvitationRepository();
  const userRepository = new FakeUserRepository(
    new Map([
      ['registered@example.com', { userId: 'user-2', activated: true }],
    ]),
  );
  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    invitationRepository,
    userRepository,
  );

  const issued = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'registered@example.com',
  );
  await invitationRepository.forceExpireInvitation(
    issued.invitationCodeHash!,
    new Date(Date.now() - 1000),
  );

  const expired = await service.validateWorkspaceInvitationCode(
    issued.invitationCode,
  );
  assert.equal(expired.status, 'expired');
  assert.equal(expired.invitation?.invitedUserId, 'user-2');
});

test('validateWorkspaceInvitationCode handles used invitation codes', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');

  const invitationRepository = new FakeInvitationRepository();
  const userRepository = new FakeUserRepository(
    new Map([
      ['registered@example.com', { userId: 'user-2', activated: true }],
    ]),
  );
  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    undefined,
    undefined,
    invitationRepository,
    userRepository,
  );

  const issued = await service.inviteUser(
    'workspace-1',
    'admin-user',
    'registered@example.com',
  );
  await invitationRepository.forceStatusByCodeHash(
    issued.invitationCodeHash!,
    'accepted',
    new Date(),
  );

  const used = await service.validateWorkspaceInvitationCode(
    issued.invitationCode,
  );
  assert.equal(used.status, 'used');
  assert.equal(used.invitation, null);
  assert.equal(used.existingUserInvite, false);
});

test('listWorkspaceUsers returns accepted and invitation rows with activation metadata', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-1', 'admin-user');
  const now = new Date();

  const workspaceRows = new Map<
    string,
    Array<{ userId: string; email: string; role?: WorkspaceRole }>
  >([
    [
      'workspace-1',
      [
        {
          userId: 'member-user',
          email: 'member@example.com',
          role: 'member',
        },
      ],
    ],
  ]);

  const invitationRepository = new FakeInvitationRepository([
    {
      workspaceId: 'workspace-1',
      invitedByUserId: 'admin-user',
      invitedUserId: null,
      invitedEmail: 'pending-invite@example.com',
      status: 'pending',
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId: 'workspace-1',
      invitedByUserId: 'admin-user',
      invitedUserId: null,
      invitedEmail: 'expired-invite@example.com',
      status: 'pending',
      expiresAt: new Date(now.getTime() - 60 * 1000),
      createdAt: new Date(now.getTime() - 60 * 1000),
    },
  ]);

  const service = makeService(
    new Map([
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    undefined,
    workspaceRows,
    undefined,
    invitationRepository,
    new FakeUserRepository(
      new Map([
        ['member@example.com', { userId: 'member-user', activated: true }],
      ]),
    ),
  );

  const rows = await service.listWorkspaceUsers('workspace-1', 'admin-user');
  assert.equal(rows.length, 3);
  const accepted = rows.find((row) => row.userId === 'member-user');
  assert.equal(accepted?.role, 'member');
  assert.equal(accepted?.activated, true);

  const pending = rows.find((row) => row.invitationStatus === 'pending');
  const expired = rows.find((row) => row.invitationStatus === 'expired');
  assert.equal(pending?.email, 'pending-invite@example.com');
  assert.equal(expired?.email, 'expired-invite@example.com');
});

test('listWorkspaces exposes summary stats for admin and member workspaces', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-admin', 'user-1');
  workspaceUsers.setMember('workspace-member', 'user-1');

  const roleFromWorkspace = (workspace: {
    currentUserRole?: WorkspaceRole;
    role?: WorkspaceRole;
  }): WorkspaceRole => {
    return workspace.currentUserRole ?? workspace.role ?? 'member';
  };

  const adminWorkspace = new Workspace(
    'workspace-admin',
    'Admin Workspace',
    'user-1',
    1,
    2,
    0,
    1,
  );
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
  assert.equal(
    roleFromWorkspace(
      summaries[0] as { currentUserRole?: WorkspaceRole; role?: WorkspaceRole },
    ),
    'admin',
  );
  assert.equal(summaries[1].id, memberWorkspace.id);
  assert.equal(summaries[1].userCount, 3);
  assert.equal(summaries[1].serviceCount, 1);
  assert.equal(
    roleFromWorkspace(
      summaries[1] as { currentUserRole?: WorkspaceRole; role?: WorkspaceRole },
    ),
    'member',
  );
});

test('listWorkspaces current-user role is workspace-scoped and independent per workspace', async () => {
  const workspaceUsers = new FakeWorkspaceUserRepository();
  workspaceUsers.setAdmin('workspace-a', 'user-1');
  workspaceUsers.setManager('workspace-b', 'user-1');

  const summaries = [
    {
      workspaceId: 'workspace-a',
      id: 'workspace-a',
      name: 'Workspace A',
      adminUserId: 'user-1',
      userCount: 1,
      serviceCount: 0,
      ownerCount: 0,
      environmentCount: 0,
      currentUserRole: 'admin',
    },
    {
      workspaceId: 'workspace-b',
      id: 'workspace-b',
      name: 'Workspace B',
      adminUserId: 'user-2',
      userCount: 2,
      serviceCount: 0,
      ownerCount: 0,
      environmentCount: 0,
      currentUserRole: 'manager',
    },
  ] as unknown as Workspace[];

  const service = makeService(
    new Map([
      [
        'workspace-a',
        new Workspace('workspace-a', 'Workspace A', 'user-1', 1, 0, 0, 0),
      ],
      [
        'workspace-b',
        new Workspace('workspace-b', 'Workspace B', 'user-2', 2, 0, 0, 0),
      ],
    ]),
    workspaceUsers,
    async () => summaries,
  );

  const list = await service.listWorkspaces('user-1');

  const roleFromWorkspace = (workspace: unknown): WorkspaceRole | undefined => {
    const roleSource = workspace as {
      currentUserRole?: WorkspaceRole;
      role?: WorkspaceRole;
    };
    return roleSource.currentUserRole ?? roleSource.role;
  };

  const workspaceA = list.find((workspace) => workspace.id === 'workspace-a');
  const workspaceB = list.find((workspace) => workspace.id === 'workspace-b');
  assert.ok(workspaceA);
  assert.ok(workspaceB);
  assert.equal(roleFromWorkspace(workspaceA), 'admin');
  assert.equal(roleFromWorkspace(workspaceB), 'manager');
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
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 2, 0, 0, 0),
      ],
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

  assert.deepEqual(rows, [
    { name: 'alice@example.com' },
    { name: 'bob@example.com' },
  ]);
  assert.deepEqual(rows.map(extractPopupRowName), [
    'alice@example.com',
    'bob@example.com',
  ]);
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
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 0, 2, 0, 0),
      ],
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
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 0, 0, 2, 0),
      ],
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

  assert.deepEqual(rows, [
    { ownerId: 'owner-a', name: 'Acme Team' },
    { ownerId: 'owner-b', name: 'Team B' },
  ]);
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
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 0, 0, 0, 2),
      ],
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

  assert.deepEqual(rows, [
    { environmentId: 'environment-a', name: 'Dev' },
    { environmentId: 'environment-b', name: 'Prod' },
  ]);
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
      [
        'workspace-1',
        new Workspace('workspace-1', 'A', 'admin-user', 1, 0, 0, 0),
      ],
    ]),
    new FakeWorkspaceUserRepository(),
    undefined,
    undefined,
    serviceRepository,
  );

  for (const resourceType of [
    'users',
    'services',
    'owners',
    'environments',
  ] as const) {
    await assert.rejects(
      () =>
        service.listWorkspacePopupRows('workspace-1', 'user-2', resourceType),
      /Not authorized for workspace/,
    );
  }

  assert.equal(serviceRepository.listCalls.users, 0);
  assert.equal(serviceRepository.listCalls.services, 0);
  assert.equal(serviceRepository.listCalls.owners, 0);
  assert.equal(serviceRepository.listCalls.environments, 0);
});
