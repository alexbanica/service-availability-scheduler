import { randomUUID } from 'crypto';
import type { Pool } from 'mysql2/promise';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { UserRepository } from '../repositories/UserRepository';
import { UserRoleRepository } from '../repositories/UserRoleRepository';
import { WorkspaceInvitationRepository } from '../repositories/WorkspaceInvitationRepository';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { WorkspaceUserRepository } from '../repositories/WorkspaceUserRepository';
import { Workspace } from '../entities/Workspace';
import { WorkspaceInvitation } from '../entities/WorkspaceInvitation';

export type WorkspaceResourceType =
  | 'users'
  | 'services'
  | 'owners'
  | 'environments';

type WorkspaceDetailItem = {
  name: string;
};

type CreateServiceInput = {
  serviceId?: string | null;
  label?: string | null;
  defaultMinutes?: number | null;
  environmentNames?: string[];
  environmentIds?: string[];
  environment_ids?: string[];
  environment_names?: string[];
  ownerId?: string | null;
  owner_id?: string | null;
};

type UpdateServiceInput = {
  serviceId: string;
  label: string;
  defaultMinutes: number;
  environmentNames?: string[];
  environmentIds?: string[];
  environment_ids?: string[];
  environment_names?: string[];
  ownerId?: string | null;
  owner_id?: string | null;
};

type OwnerOrEnvironmentInput = {
  name: string;
};

export class WorkspaceService {
  private static readonly MAX_WORKSPACES_PER_ADMIN = 5;

  constructor(
    private readonly db: Pool,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspaceUserRepository: WorkspaceUserRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly invitationRepository: WorkspaceInvitationRepository,
    private readonly userRepository: UserRepository,
    private readonly userRoleRepository: UserRoleRepository,
  ) {}

  async listWorkspaces(userId: string): Promise<Workspace[]> {
    return this.workspaceRepository.listByUser(userId);
  }

  async createWorkspace(userId: string, name: string): Promise<Workspace> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Workspace name required');
    }

    const isAdmin = await this.userRoleRepository.isPlatformAdmin(userId);
    if (!isAdmin) {
      throw new Error('Not authorized to create workspaces');
    }

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const workspaceRepo = this.workspaceRepository.withConnection(connection);
      const workspaceUserRepo =
        this.workspaceUserRepository.withConnection(connection);

      const total = await workspaceRepo.countByAdmin(userId);
      if (total >= WorkspaceService.MAX_WORKSPACES_PER_ADMIN) {
        throw new Error('Workspace limit reached');
      }

      const workspaceId = randomUUID();
      const workspace = await workspaceRepo.insert(
        workspaceId,
        trimmedName,
        userId,
      );
      await workspaceUserRepo.insert(workspace.id, userId, 'admin');

      await connection.commit();
      return new Workspace(
        workspace.id,
        workspace.name,
        workspace.adminUserId,
        1,
        0,
        0,
        0,
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createEnvironment(
    workspaceId: string,
    userId: string,
    input: OwnerOrEnvironmentInput,
  ): Promise<{ environmentId: string }> {
    const trimmedName = (input.name || '').trim();
    if (!trimmedName) {
      throw new Error('Environment name is required');
    }

    await this.assertWorkspaceAdmin(workspaceId, userId);

    const existing = await this.serviceRepository.findEnvironmentByName(
      workspaceId,
      trimmedName,
    );
    if (existing) {
      throw new Error('Environment already exists');
    }

    const environmentId = randomUUID();
    await this.serviceRepository.insertEnvironment({
      workspaceId,
      environmentId,
      name: trimmedName,
    });

    return { environmentId };
  }

  async createOwner(
    workspaceId: string,
    userId: string,
    input: OwnerOrEnvironmentInput,
  ): Promise<{ ownerId: string }> {
    const trimmedName = (input.name || '').trim();
    if (!trimmedName) {
      throw new Error('Owner name is required');
    }

    await this.assertWorkspaceAdmin(workspaceId, userId);

    const existing = await this.serviceRepository.findOwnerByWorkspaceAndName(
      workspaceId,
      trimmedName,
    );
    if (existing) {
      throw new Error('Owner already exists');
    }

    const ownerId = randomUUID();
    await this.serviceRepository.insertOwner({
      workspaceId,
      ownerId,
      name: trimmedName,
    });
    return { ownerId };
  }

  async createService(
    workspaceId: string,
    userId: string,
    input: CreateServiceInput,
  ): Promise<{ serviceId: string; createdEnvironments: number }> {
    const environmentIds = this.normalizeIds(
      input.environmentIds ?? input.environment_ids,
    );
    const environmentNames = this.normalizeEnvironmentNames(
      input.environmentNames ?? input.environment_names,
    );
    if (!environmentIds.length && !environmentNames.length) {
      throw new Error('Select at least one environment.');
    }

    await this.assertWorkspaceAdmin(workspaceId, userId);

    const label = (input.label || '').trim();
    if (!label) {
      throw new Error('Service name required');
    }

    const defaultMinutes = Number(input.defaultMinutes || 0);
    if (!Number.isFinite(defaultMinutes) || defaultMinutes <= 0) {
      throw new Error('Default minutes must be positive');
    }

    const ownerId = this.normalizeOptionalId(input.ownerId ?? input.owner_id);
    if (ownerId) {
      const ownerExists =
        await this.serviceRepository.isWorkspaceOwnerOwnedByWorkspace(
          workspaceId,
          ownerId,
        );
      if (!ownerExists) {
        throw new Error('Owner not found in workspace');
      }
    }

    const serviceId = randomUUID();

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const serviceRepo = this.serviceRepository.withConnection(connection);
      const resolvedEnvironmentIds = await this.resolveEnvironmentIds(
        workspaceId,
        serviceRepo,
        environmentIds,
        environmentNames,
      );

      if (!resolvedEnvironmentIds.length) {
        throw new Error('Select at least one environment.');
      }

      const createdServiceId = await serviceRepo.insertService({
        workspaceId,
        serviceId,
        label,
        defaultMinutes,
        ownerId,
      });

      let createdEnvironments = 0;
      for (const environmentId of resolvedEnvironmentIds) {
        await serviceRepo.insertServiceEnvironment({
          serviceId,
          environmentId,
          serviceKey: `${serviceId}:${environmentId}`,
        });
        createdEnvironments += 1;
      }

      await connection.commit();
      return { serviceId: createdServiceId, createdEnvironments };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listEnvironments(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    return this.serviceRepository.listEnvironmentsByWorkspace(workspaceId);
  }

  async listOwners(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ ownerId: string; name: string }>> {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    return this.serviceRepository.listOwnersByWorkspace(workspaceId);
  }

  async listServiceCatalog(
    workspaceId: string,
    userId: string,
  ): Promise<
    Array<{
      serviceId: string;
      label: string;
      owner: string | null;
      ownerId: string | null;
      defaultMinutes: number;
      environments: Array<{ environmentId: string; environmentName: string }>;
    }>
  > {
    await this.assertWorkspaceMember(workspaceId, userId);

    const rows =
      await this.serviceRepository.listServiceCatalogByWorkspace(workspaceId);
    const map = new Map<
      string,
      {
        serviceId: string;
        label: string;
        owner: string | null;
        ownerId: string | null;
        defaultMinutes: number;
        environments: Array<{ environmentId: string; environmentName: string }>;
      }
    >();

    rows.forEach((row) => {
      const current = map.get(row.serviceId);
      const env = {
        environmentId: row.environmentId,
        environmentName: row.environmentName,
      };
      if (current) {
        current.environments.push(env);
        return;
      }
      map.set(row.serviceId, {
        serviceId: row.serviceId,
        label: row.label,
        owner: row.ownerName,
        ownerId: row.ownerId,
        defaultMinutes: row.defaultMinutes,
        environments: [env],
      });
    });

    return Array.from(map.values());
  }

  async listWorkspacePopupRows(
    workspaceId: string,
    userId: string,
    resourceType: WorkspaceResourceType,
  ): Promise<WorkspaceDetailItem[]> {
    await this.assertWorkspaceMember(workspaceId, userId);

    if (resourceType === 'users') {
      const users =
        await this.workspaceRepository.listUsersByWorkspace(workspaceId);
      return users.map((user) => ({ name: user.email }));
    }

    if (resourceType === 'services') {
      const services =
        await this.serviceRepository.listServiceSummariesByWorkspace(
          workspaceId,
        );
      return services.map((service) => ({ name: service.label }));
    }

    if (resourceType === 'owners') {
      const owners =
        await this.serviceRepository.listOwnersByWorkspace(workspaceId);
      return owners.map((owner) => ({ name: owner.name }));
    }

    const environments =
      await this.serviceRepository.listEnvironmentsByWorkspace(workspaceId);
    return environments.map((environment) => ({
      name: environment.environmentName,
    }));
  }

  async deleteService(
    workspaceId: string,
    userId: string,
    serviceId: string,
  ): Promise<void> {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    const affected = await this.serviceRepository.deleteServiceByWorkspaceAndId(
      workspaceId,
      serviceId,
    );
    if (!affected) {
      throw new Error('Service not found');
    }
  }

  async updateService(
    workspaceId: string,
    userId: string,
    input: UpdateServiceInput,
  ): Promise<{ serviceId: string }> {
    const serviceId = this.normalizeRequiredId(input.serviceId);
    const label = (input.label || '').trim();
    if (!label) {
      throw new Error('Service name required');
    }

    const defaultMinutes = Number(input.defaultMinutes || 0);
    if (!Number.isFinite(defaultMinutes) || defaultMinutes <= 0) {
      throw new Error('Default minutes must be positive');
    }

    const environmentIds = this.normalizeIds(
      input.environmentIds ?? input.environment_ids,
    );
    const environmentNames = this.normalizeEnvironmentNames(
      input.environmentNames ?? input.environment_names,
    );
    if (!environmentIds.length && !environmentNames.length) {
      throw new Error('At least one environment is required');
    }

    await this.assertWorkspaceAdmin(workspaceId, userId);

    const normalizedOwnerId = this.normalizeOptionalId(
      input.ownerId ?? input.owner_id,
    );

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const serviceRepo = this.serviceRepository.withConnection(connection);
      const resolvedEnvironmentIds = await this.resolveEnvironmentIds(
        workspaceId,
        serviceRepo,
        environmentIds,
        environmentNames,
      );
      if (!resolvedEnvironmentIds.length) {
        throw new Error('At least one environment is required');
      }

      const existingService = await serviceRepo.findServiceByWorkspaceAndId(
        workspaceId,
        serviceId,
      );
      if (!existingService) {
        throw new Error('Service not found');
      }

      if (normalizedOwnerId) {
        const ownerExists = await serviceRepo.isWorkspaceOwnerOwnedByWorkspace(
          workspaceId,
          normalizedOwnerId,
        );
        if (!ownerExists) {
          throw new Error('Owner not found in workspace');
        }
      }

      await serviceRepo.updateServiceMetadata(
        workspaceId,
        serviceId,
        label,
        defaultMinutes,
        normalizedOwnerId,
      );

      for (const environmentId of resolvedEnvironmentIds) {
        try {
          await serviceRepo.insertServiceEnvironment({
            serviceId,
            environmentId,
            serviceKey: `${serviceId}:${environmentId}`,
          });
        } catch (error) {
          const err = error as { code?: string };
          if (err.code !== 'ER_DUP_ENTRY') {
            throw error;
          }
        }
      }

      await serviceRepo.deleteServiceEnvironmentAssociationsNotIn(
        serviceId,
        resolvedEnvironmentIds,
      );

      await connection.commit();
      return { serviceId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async inviteUser(
    workspaceId: string,
    userId: string,
    inviteeEmail: string,
  ): Promise<WorkspaceInvitation> {
    const trimmedEmail = inviteeEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      throw new Error('Invitee email required');
    }

    await this.assertWorkspaceAdmin(workspaceId, userId);

    const invitee = await this.userRepository.findByEmail(trimmedEmail);
    if (!invitee) {
      throw new Error('Invitee not found');
    }

    const isMember = await this.workspaceUserRepository.isMember(
      workspaceId,
      invitee.userId,
    );
    if (isMember) {
      throw new Error('User already in workspace');
    }

    try {
      return await this.invitationRepository.insert(
        randomUUID(),
        workspaceId,
        invitee.userId,
        userId,
      );
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error('Invitation already pending');
      }
      throw error;
    }
  }

  private async assertWorkspaceAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    const isAdmin = await this.workspaceUserRepository.isAdmin(
      workspace.id,
      userId,
    );
    if (!isAdmin) {
      throw new Error('Not authorized for workspace');
    }
  }

  private async assertWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    const isMember = await this.workspaceUserRepository.isMember(
      workspace.id,
      userId,
    );
    if (!isMember) {
      throw new Error('Not authorized for workspace');
    }
  }

  private normalizeIds(values: string[] | undefined): string[] {
    return Array.isArray(values)
      ? values
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0)
      : [];
  }

  private normalizeEnvironmentNames(values: string[] | undefined): string[] {
    return Array.isArray(values)
      ? values
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0)
      : [];
  }

  private dedupeCaseInsensitive(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    values.forEach((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      output.push(value);
    });
    return output;
  }

  private async resolveEnvironmentIds(
    workspaceId: string,
    serviceRepo: ServiceRepository,
    environmentIds: string[],
    environmentNames: string[],
  ): Promise<string[]> {
    const seen = new Set<string>();
    const resolvedIds: string[] = [];

    const uniqueEnvironmentIds = this.dedupeCaseInsensitive(environmentIds);
    for (const environmentId of uniqueEnvironmentIds) {
      const belongsToWorkspace = await serviceRepo.getEnvironmentById(
        workspaceId,
        environmentId,
      );
      if (!belongsToWorkspace) {
        throw new Error('Environment not found in workspace');
      }
      const key = environmentId.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      resolvedIds.push(environmentId);
    }

    const uniqueEnvironmentNames = this.dedupeCaseInsensitive(
      this.normalizeEnvironmentNames(environmentNames),
    );
    if (!uniqueEnvironmentNames.length) {
      return resolvedIds;
    }

    const existingByName = await serviceRepo.findEnvironmentByWorkspaceAndNames(
      workspaceId,
      uniqueEnvironmentNames,
    );
    const existingEnvironmentMap = new Map<string, string>();
    existingByName.forEach((environment) => {
      existingEnvironmentMap.set(
        environment.environmentName.toLowerCase(),
        environment.environmentId,
      );
    });

    for (const environmentName of uniqueEnvironmentNames) {
      const existingEnvironmentId = existingEnvironmentMap.get(
        environmentName.toLowerCase(),
      );
      if (existingEnvironmentId) {
        const key = existingEnvironmentId.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          resolvedIds.push(existingEnvironmentId);
        }
        continue;
      }

      const createdEnvironmentId = randomUUID();
      await serviceRepo.insertEnvironment({
        workspaceId,
        environmentId: createdEnvironmentId,
        name: environmentName,
      });
      resolvedIds.push(createdEnvironmentId);
      seen.add(createdEnvironmentId.toLowerCase());
    }

    return resolvedIds;
  }

  private normalizeOptionalId(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeRequiredId(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('Service not found');
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error('Service not found');
    }
    return trimmed;
  }
}
