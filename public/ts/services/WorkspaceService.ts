import { ApiService } from './ApiService.js';
import { Workspace, WorkspaceRole } from '../entities/Workspace.js';

export type WorkspaceOwnerOption = {
  ownerId: string;
  name: string;
};

export type WorkspaceUserRow = {
  userId: string;
  email: string;
  role: WorkspaceRole;
  activated?: boolean;
  invitationId?: string;
  invitationStatus?: 'pending' | 'expired';
  invitationExpiresAt?: string;
  invitedByUserId?: string;
  invitedUserId?: string | null;
};

export type WorkspaceInvitationValidation = {
  status: 'invalid' | 'expired' | 'used' | 'wrong_user' | 'unregistered' | 'valid';
  existingUserInvite: boolean;
  invitation: {
    workspaceId: string;
    invitedUserId: string | null;
    invitedByUserId: string;
    invitedEmail: string;
    expiresAt: string;
  } | null;
};

export type WorkspaceResourceType =
  | 'users'
  | 'services'
  | 'owners'
  | 'environments';

export class WorkspaceService {
  static async list(): Promise<Workspace[]> {
    const response = await ApiService.get('/api/workspaces');
    if (!response.ok) {
      throw new Error('Failed to load workspaces');
    }
    const data = (await response.json()) as {
      workspaces: Array<Record<string, unknown>>;
    };

    return data.workspaces.map(
      (workspace) =>
        new Workspace(
          this.asString(workspace.id, ''),
          this.asString(workspace.name, 'Untitled'),
          this.asString(workspace.admin_user_id, ''),
          this.asNumber(workspace.user_count, 0),
          this.asNumber(workspace.service_count, 0),
          this.asNumber(workspace.owner_count, 0),
          this.asNumber(workspace.environment_count, 0),
          this.asWorkspaceRole(workspace.current_user_role),
        ),
    );
  }

  static async create(name: string): Promise<Workspace> {
    const response = await ApiService.post('/api/workspaces', { name });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to create workspace',
      );
    }
    return new Workspace(
      this.asString(data.id, ''),
      this.asString(data.name, ''),
      this.asString(data.admin_user_id, ''),
      this.asNumber(data.user_count, 0),
      this.asNumber(data.service_count, 0),
      this.asNumber(data.owner_count, 0),
      this.asNumber(data.environment_count, 0),
      this.asWorkspaceRole(data.current_user_role),
    );
  }

  static async invite(workspaceId: string, email: string): Promise<void> {
    const response = await ApiService.post(
      `/api/workspaces/${workspaceId}/invitations`,
      { email },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to send invitation',
      );
    }
  }

  static async createService(
    workspaceId: string,
    input: {
      environmentNames?: string[];
      environmentIds: string[];
      serviceId?: string | null;
      label?: string;
      defaultMinutes?: number;
      ownerId?: string | null;
    },
  ): Promise<void> {
    const response = await ApiService.post(
      `/api/workspaces/${workspaceId}/services`,
      {
        environment_ids: input.environmentIds,
        environment_names: input.environmentNames,
        service_id: input.serviceId || null,
        label: input.label || null,
        default_minutes: input.defaultMinutes || null,
        owner_id: input.ownerId || null,
      },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to create service',
      );
    }
  }

  static async updateService(
    workspaceId: string,
    serviceId: string,
    input: {
      environmentNames?: string[];
      environmentIds: string[];
      label: string;
      defaultMinutes: number;
      ownerId?: string | null;
    },
  ): Promise<{ serviceId: string }> {
    const response = await ApiService.patch(
      `/api/workspaces/${workspaceId}/services/${encodeURIComponent(
        serviceId,
      )}`,
      {
        environment_ids: input.environmentIds,
        environment_names: input.environmentNames,
        label: input.label,
        default_minutes: input.defaultMinutes,
        owner_id: input.ownerId || null,
      },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to update service',
      );
    }
    return {
      serviceId:
        typeof data.service_id === 'string' ? data.service_id : serviceId,
    };
  }

  static async deleteService(
    workspaceId: string,
    serviceId: string,
  ): Promise<void> {
    const response = await ApiService.delete(
      `/api/workspaces/${workspaceId}/services/${encodeURIComponent(
        serviceId,
      )}`,
    );
    if (!response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to delete service',
      );
    }
  }

  static async listEnvironments(
    workspaceId: string,
  ): Promise<Array<{ environmentId: string; environmentName: string }>> {
    const response = await ApiService.get(
      `/api/workspaces/${workspaceId}/environments`,
    );
    const data = (await response.json()) as {
      environments: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to load environments',
      );
    }
    return data.environments.map((env) => ({
      environmentId: this.asString(env.environment_id, ''),
      environmentName: this.asString(env.environment_name, ''),
    }));
  }

  static async listOwners(
    workspaceId: string,
  ): Promise<WorkspaceOwnerOption[]> {
    const response = await ApiService.get(
      `/api/workspaces/${workspaceId}/owners`,
    );
    const data = (await response.json()) as {
      owners: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : 'Failed to load owners',
      );
    }
    return data.owners.map((owner) => ({
      ownerId: this.asString(owner.owner_id, ''),
      name: this.asString(owner.name, ''),
    }));
  }

  static async createEnvironment(
    workspaceId: string,
    name: string,
  ): Promise<void> {
    const response = await ApiService.post(
      `/api/workspaces/${workspaceId}/environments`,
      { name },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to create environment',
      );
    }
  }

  static async createOwner(workspaceId: string, name: string): Promise<void> {
    const response = await ApiService.post(
      `/api/workspaces/${workspaceId}/owners`,
      { name },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : 'Failed to create owner',
      );
    }
  }

  static async listWorkspaceRows(
    workspaceId: string,
    resourceType: WorkspaceResourceType,
  ): Promise<
    Array<{ name: string; ownerId?: string; environmentId?: string }>
  > {
    const path = `/api/workspaces/${workspaceId}/detail/${resourceType}`;
    const response = await ApiService.get(path);
    const data = (await response.json()) as {
      items?: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to load workspace details',
      );
    }
    return Array.isArray(data.items)
      ? data.items.map((row) => {
          const ownerId = (row as { ownerId?: unknown }).ownerId;
          const environmentId = (row as { environmentId?: unknown })
            .environmentId;
          return {
            name: this.asString((row as { name?: unknown }).name, ''),
            ...(typeof ownerId === 'string' ? { ownerId } : {}),
            ...(typeof environmentId === 'string' ? { environmentId } : {}),
          };
        })
      : [];
  }

  static async deleteOwner(
    workspaceId: string,
    ownerId: string,
  ): Promise<void> {
    const response = await ApiService.delete(
      `/api/workspaces/${workspaceId}/owners/${encodeURIComponent(ownerId)}`,
    );
    if (!response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to delete owner',
      );
    }
  }

  static async deleteEnvironment(
    workspaceId: string,
    environmentId: string,
  ): Promise<void> {
    const response = await ApiService.delete(
      `/api/workspaces/${workspaceId}/environments/${encodeURIComponent(
        environmentId,
      )}`,
    );
    if (!response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to delete environment',
      );
    }
  }

  static async listWorkspaceUsers(workspaceId: string): Promise<WorkspaceUserRow[]> {
    const response = await ApiService.get(
      `/api/workspaces/${workspaceId}/users`,
    );
    const data = (await response.json()) as {
      users?: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to load workspace users',
      );
    }
    return Array.isArray(data.users)
      ? data.users.map((userRow) => ({
          userId: this.asString(userRow.user_id, ''),
          email: this.asString(userRow.email, ''),
          role: this.asWorkspaceRole(userRow.role),
          activated:
            typeof userRow.activated === 'boolean'
              ? userRow.activated
              : undefined,
          invitationId: this.asOptionalString(userRow.invitation_id),
          invitationStatus: this.asInvitationStatus(
            userRow.invitation_status,
          ),
          invitationExpiresAt: this.asOptionalString(
            userRow.invitation_expires_at,
          ),
          invitedByUserId: this.asOptionalString(userRow.invited_by_user_id),
          invitedUserId:
            userRow.invited_user_id === null
              ? null
              : this.asOptionalString(userRow.invited_user_id),
        }))
      : [];
  }

  static async validateInvitation(
    code: string,
  ): Promise<WorkspaceInvitationValidation> {
    const response = await ApiService.get(
      `/api/workspace-invitations/${encodeURIComponent(code)}/validate`,
    );
    const data = (await response.json()) as {
      status?: unknown;
      existing_user_invite?: unknown;
      invitation?: Record<string, unknown> | null;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to validate invitation',
      );
    }
    const invitation = data.invitation;
    return {
      status: this.asInvitationValidationStatus(data.status),
      existingUserInvite: data.existing_user_invite === true,
      invitation: invitation
        ? {
            workspaceId: this.asString(invitation.workspace_id, ''),
            invitedUserId:
              invitation.invited_user_id === null
                ? null
                : this.asNullableString(invitation.invited_user_id),
            invitedByUserId: this.asString(invitation.invited_by_user_id, ''),
            invitedEmail: this.asString(invitation.invited_email, ''),
            expiresAt: this.asString(invitation.expires_at, ''),
          }
        : null,
    };
  }

  static async acceptInvitation(code: string): Promise<void> {
    const response = await ApiService.post(
      `/api/workspace-invitations/${encodeURIComponent(code)}/accept`,
    );
    if (!response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to accept invitation',
      );
    }
  }

  static async updateWorkspaceUserRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<{ userId: string; role: WorkspaceRole }> {
    const response = await ApiService.patch(
      `/api/workspaces/${workspaceId}/users/${encodeURIComponent(userId)}/role`,
      { role },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to update workspace user role',
      );
    }
    return {
      userId: this.asString(data.user_id, userId),
      role: this.asWorkspaceRole(data.role),
    };
  }

  static async removeWorkspaceUser(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const response = await ApiService.delete(
      `/api/workspaces/${workspaceId}/users/${encodeURIComponent(userId)}`,
    );
    if (!response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to remove workspace user',
      );
    }
  }

  static async listServiceCatalog(workspaceId: string): Promise<
    Array<{
      serviceId: string;
      label: string;
      owner: string | null;
      ownerId: string | null;
      defaultMinutes: number;
      environments: Array<{ environmentId: string; environmentName: string }>;
    }>
  > {
    const response = await ApiService.get(
      `/api/workspaces/${workspaceId}/services`,
    );
    const data = (await response.json()) as {
      services: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : 'Failed to load services',
      );
    }
    return data.services.map((svc) => ({
      serviceId: this.asString(svc.service_id, ''),
      label: this.asString(svc.label, ''),
      owner: this.asNullableString(svc.owner),
      ownerId: this.asNullableString(svc.owner_id),
      defaultMinutes: this.asNumber(svc.default_minutes, 0),
      environments: Array.isArray(svc.environments)
        ? svc.environments.map((env) => ({
            environmentId: this.asString(env.environment_id, ''),
            environmentName: this.asString(env.environment_name, ''),
          }))
        : [],
    }));
  }

  private static asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private static asNullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private static asOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private static asNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  private static asWorkspaceRole(value: unknown): WorkspaceRole {
    return value === 'admin' || value === 'manager' || value === 'member'
      ? value
      : 'member';
  }

  private static asInvitationStatus(
    value: unknown,
  ): 'pending' | 'expired' | undefined {
    return value === 'pending' || value === 'expired' ? value : undefined;
  }

  private static asInvitationValidationStatus(
    value: unknown,
  ): WorkspaceInvitationValidation['status'] {
    return value === 'expired' ||
      value === 'used' ||
      value === 'wrong_user' ||
      value === 'unregistered' ||
      value === 'valid'
      ? value
      : 'invalid';
  }
}
