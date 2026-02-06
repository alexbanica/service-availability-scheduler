import type { Pool } from 'mysql2/promise';
import { randomUUID } from 'crypto';
import { Workspace } from '../entities/Workspace';
import { WorkspaceInvitation } from '../entities/WorkspaceInvitation';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { UserRepository } from '../repositories/UserRepository';
import { UserRoleRepository } from '../repositories/UserRoleRepository';
import { WorkspaceInvitationRepository } from '../repositories/WorkspaceInvitationRepository';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { WorkspaceUserRepository } from '../repositories/WorkspaceUserRepository';

type ServiceInput = {
  environmentNames: string[];
  serviceId?: string | null;
  label?: string | null;
  defaultMinutes?: number | null;
  owner?: string | null;
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

  async listWorkspaces(userId: number): Promise<Workspace[]> {
    return this.workspaceRepository.listByUser(userId);
  }

  async createWorkspace(userId: number, name: string): Promise<Workspace> {
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
      const workspaceRepo = new WorkspaceRepository(connection);
      const workspaceUserRepo = new WorkspaceUserRepository(connection);

      const total = await workspaceRepo.countByAdmin(userId);
      if (total >= WorkspaceService.MAX_WORKSPACES_PER_ADMIN) {
        throw new Error('Workspace limit reached');
      }

      const workspace = await workspaceRepo.insert(trimmedName, userId);
      await workspaceUserRepo.insert(workspace.id, userId, 'admin');

      await connection.commit();
      return workspace;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createService(
    workspaceId: number,
    userId: number,
    input: ServiceInput,
  ): Promise<{ serviceId: string; createdEnvironments: number }> {
    const environments = input.environmentNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    if (!environments.length) {
      throw new Error('At least one environment is required');
    }

    await this.assertWorkspaceAdmin(workspaceId, userId);

    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const serviceRepo = new ServiceRepository(connection);

      let serviceDbId: number;
      let serviceUuid: string;

      const providedServiceId = (input.serviceId || '').trim();
      if (providedServiceId) {
        const existing = await serviceRepo.findServiceByUuid(
          workspaceId,
          providedServiceId,
        );
        if (!existing) {
          throw new Error('Service not found');
        }
        serviceDbId = existing.id;
        serviceUuid = existing.serviceId;
      } else {
        const label = (input.label || '').trim();
        if (!label) {
          throw new Error('Service label required');
        }
        const defaultMinutes = Number(input.defaultMinutes || 0);
        if (!Number.isFinite(defaultMinutes) || defaultMinutes <= 0) {
          throw new Error('Default minutes must be positive');
        }
        serviceUuid = randomUUID();
        serviceDbId = await serviceRepo.insertService({
          workspaceId,
          serviceId: serviceUuid,
          label,
          defaultMinutes,
          owner: input.owner ? input.owner.trim() || null : null,
        });
      }

      let createdEnvironments = 0;
      for (const name of environments) {
        const existingEnv = await serviceRepo.findEnvironmentByName(
          workspaceId,
          name,
        );
        let environmentDbId: number;
        let environmentUuid: string;
        if (existingEnv) {
          environmentDbId = existingEnv.id;
          environmentUuid = existingEnv.environmentId;
        } else {
          environmentUuid = randomUUID();
          environmentDbId = await serviceRepo.insertEnvironment({
            workspaceId,
            environmentId: environmentUuid,
            name,
          });
        }
        try {
          await serviceRepo.insertServiceEnvironment({
            serviceDbId,
            environmentDbId,
            serviceKey: `${serviceUuid}:${environmentUuid}`,
          });
          createdEnvironments += 1;
        } catch (error) {
          const err = error as { code?: string };
          if (err.code !== 'ER_DUP_ENTRY') {
            throw error;
          }
        }
      }

      await connection.commit();
      return { serviceId: serviceUuid, createdEnvironments };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listEnvironments(
    workspaceId: number,
    userId: number,
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    return this.serviceRepository.listEnvironmentsByWorkspace(workspaceId);
  }

  async listOwners(
    workspaceId: number,
    userId: number,
  ): Promise<Array<{ owner: string }>> {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    const owners = await this.serviceRepository.listOwnersByWorkspace(
      workspaceId,
    );
    return owners.map((owner) => ({ owner }));
  }

  async listServiceCatalog(
    workspaceId: number,
    userId: number,
  ): Promise<
    Array<{
      serviceId: string;
      label: string;
      owner: string | null;
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
        defaultMinutes: number;
        environments: Array<{ environmentId: string; environmentName: string }>;
      }
    >();
    rows.forEach((row) => {
      const existing = map.get(row.serviceId);
      const env = {
        environmentId: row.environmentId,
        environmentName: row.environmentName,
      };
      if (existing) {
        existing.environments.push(env);
        return;
      }
      map.set(row.serviceId, {
        serviceId: row.serviceId,
        label: row.label,
        owner: row.owner,
        defaultMinutes: row.defaultMinutes,
        environments: [env],
      });
    });
    return Array.from(map.values());
  }

  async deleteService(
    workspaceId: number,
    userId: number,
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

  async inviteUser(
    workspaceId: number,
    userId: number,
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
      invitee.id,
    );
    if (isMember) {
      throw new Error('User already in workspace');
    }

    try {
      return await this.invitationRepository.insert(
        workspaceId,
        invitee.id,
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
    workspaceId: number,
    userId: number,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    const isAdmin = await this.workspaceUserRepository.isAdmin(
      workspaceId,
      userId,
    );
    if (!isAdmin) {
      throw new Error('Not authorized for workspace');
    }
  }

  private async assertWorkspaceMember(
    workspaceId: number,
    userId: number,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    const isMember = await this.workspaceUserRepository.isMember(
      workspaceId,
      userId,
    );
    if (!isMember) {
      throw new Error('Not authorized for workspace');
    }
  }
}
