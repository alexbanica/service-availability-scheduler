import { ApiService } from './ApiService.js';
import { Workspace } from '../entities/Workspace.js';

export type WorkspaceOwnerOption = {
  ownerId: string;
  name: string;
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

    return data.workspaces.map((workspace) =>
      new Workspace(
        this.asString(workspace.id, ''),
        this.asString(workspace.name, 'Untitled'),
        this.asString(workspace.admin_user_id, ''),
        this.asNumber(workspace.user_count, 0),
        this.asNumber(workspace.service_count, 0),
        this.asNumber(workspace.owner_count, 0),
        this.asNumber(workspace.environment_count, 0),
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
      environmentIds: string[];
      label: string;
      defaultMinutes: number;
      ownerId?: string | null;
    },
  ): Promise<{ serviceId: string }> {
    const response = await fetch(
      `/api/workspaces/${workspaceId}/services/${encodeURIComponent(
        serviceId,
      )}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          environment_ids: input.environmentIds,
          label: input.label,
          default_minutes: input.defaultMinutes,
          owner_id: input.ownerId || null,
        }),
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

  static async listOwners(workspaceId: string): Promise<WorkspaceOwnerOption[]> {
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
  ): Promise<Array<Record<string, unknown>>> {
    const response = await ApiService.get(
      `/api/workspaces/${workspaceId}/${resourceType}`,
    );
    const data = (await response.json()) as {
      rows?: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to load workspace details',
      );
    }
    return data.rows || [];
  }

  static async listServiceCatalog(
    workspaceId: string,
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
    const response = await ApiService.get(
      `/api/workspaces/${workspaceId}/services`,
    );
    const data = (await response.json()) as {
      services: Array<Record<string, unknown>>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to load services',
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

  private static asNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
  }
}
