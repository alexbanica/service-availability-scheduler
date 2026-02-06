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
  environmentId: string;
  environmentName: string;
  serviceId: string;
  label?: string | null;
  defaultMinutes: number;
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
  ): Promise<{ id: number; serviceKey: string }> {
    if (!input.environmentName.trim()) {
      throw new Error('Environment name required');
    }
    if (!Number.isFinite(input.defaultMinutes) || input.defaultMinutes <= 0) {
      throw new Error('Default minutes must be positive');
    }

    await this.assertWorkspaceAdmin(workspaceId, userId);

    const environmentId = input.environmentId.trim() || randomUUID();
    const serviceId = input.serviceId.trim() || randomUUID();
    const serviceKey = `${environmentId}:${serviceId}`;
    const label = (input.label || serviceId).trim();
    const owner = input.owner ? input.owner.trim() : null;

    try {
      const id = await this.serviceRepository.insertService({
        workspaceId,
        serviceKey,
        environmentId,
        environmentName: input.environmentName.trim(),
        serviceId,
        label,
        defaultMinutes: input.defaultMinutes,
        owner: owner && owner.length ? owner : null,
      });
      return { id, serviceKey };
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error('Service already exists');
      }
      throw error;
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
    }>
  > {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    return this.serviceRepository.listServiceCatalogByWorkspace(workspaceId);
  }

  async deleteService(
    workspaceId: number,
    userId: number,
    serviceKey: string,
  ): Promise<void> {
    await this.assertWorkspaceAdmin(workspaceId, userId);
    const affected = await this.serviceRepository.deleteByWorkspaceAndKey(
      workspaceId,
      serviceKey,
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
}
