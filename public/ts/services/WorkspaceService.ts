import { ApiService } from './ApiService.js';
import { Workspace } from '../entities/Workspace.js';

export class WorkspaceService {
  static async list(): Promise<Workspace[]> {
    const response = await ApiService.get('/api/workspaces');
    if (!response.ok) {
      throw new Error('Failed to load workspaces');
    }
    const data = (await response.json()) as {
      workspaces: Array<Record<string, unknown>>;
    };

    const asNumber = (value: unknown, fallback = 0): number =>
      typeof value === 'number' && !Number.isNaN(value) ? value : fallback;

    const asString = (value: unknown, fallback = ''): string =>
      typeof value === 'string' ? value : fallback;

    return data.workspaces.map(
      (workspace) =>
        new Workspace(
          asNumber(workspace.id, 0),
          asString(workspace.name, 'Untitled'),
          asNumber(workspace.admin_user_id, 0),
        ),
    );
  }

  static async create(name: string): Promise<Workspace> {
    const response = await ApiService.post('/api/workspaces', { name });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : 'Failed to create workspace',
      );
    }
    return new Workspace(
      Number(data.id),
      String(data.name || ''),
      Number(data.admin_user_id),
    );
  }

  static async invite(workspaceId: number, email: string): Promise<void> {
    const response = await ApiService.post(
      `/api/workspaces/${workspaceId}/invitations`,
      { email },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : 'Failed to send invitation',
      );
    }
  }

  static async createService(
    workspaceId: number,
    input: {
      environmentNames: string[];
      serviceId?: string | null;
      label?: string;
      defaultMinutes?: number;
      owner?: string;
    },
  ): Promise<void> {
    const response = await ApiService.post(
      `/api/workspaces/${workspaceId}/services`,
      {
        environment_names: input.environmentNames,
        service_id: input.serviceId || null,
        label: input.label || null,
        default_minutes: input.defaultMinutes || null,
        owner: input.owner || null,
      },
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string' ? data.error : 'Failed to create service',
      );
    }
  }

  static async deleteService(
    workspaceId: number,
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
        typeof data.error === 'string' ? data.error : 'Failed to delete service',
      );
    }
  }

  static async listEnvironments(
    workspaceId: number,
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
    const asString = (value: unknown, fallback = ''): string =>
      typeof value === 'string' ? value : fallback;
    return data.environments.map((env) => ({
      environmentId: asString(env.environment_id, ''),
      environmentName: asString(env.environment_name, ''),
    }));
  }

  static async listOwners(workspaceId: number): Promise<string[]> {
    const response = await ApiService.get(
      `/api/workspaces/${workspaceId}/owners`,
    );
    const data = (await response.json()) as {
      owners: Array<unknown>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Failed to load owners',
      );
    }
    return data.owners
      .map((owner) => (typeof owner === 'string' ? owner : ''))
      .filter((owner) => owner.length > 0);
  }

  static async listServiceCatalog(
    workspaceId: number,
  ): Promise<
    Array<{
      serviceId: string;
      label: string;
      owner: string | null;
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
    const asString = (value: unknown, fallback = ''): string =>
      typeof value === 'string' ? value : fallback;
    const asNumber = (value: unknown, fallback = 0): number =>
      typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
    const asNullableString = (value: unknown): string | null =>
      typeof value === 'string' ? value : null;
    return data.services.map((svc) => ({
      serviceId: asString(svc.service_id, ''),
      label: asString(svc.label, ''),
      owner: asNullableString(svc.owner),
      defaultMinutes: asNumber(svc.default_minutes, 0),
      environments: Array.isArray(svc.environments)
        ? svc.environments.map((env) => ({
            environmentId: asString(env.environment_id, ''),
            environmentName: asString(env.environment_name, ''),
          }))
        : [],
    }));
  }
}
