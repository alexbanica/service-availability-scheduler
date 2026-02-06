import { ApiService } from './ApiService.js';
import { Service, ServiceEnvironment } from '../entities/Service.js';
import { ServicesResponseDto } from '../dtos/ServicesResponseDto.js';

export class ReservationService {
  static async loadServices(): Promise<ServicesResponseDto> {
    const response = await ApiService.get('/api/services');
    if (!response.ok) {
      throw new Error('Failed to load services');
    }
    const data = (await response.json()) as {
      expiry_warning_minutes: number;
      auto_refresh_minutes: number;
      services: Array<Record<string, unknown>>;
    };

    const asString = (value: unknown, fallback = ''): string =>
      typeof value === 'string' ? value : fallback;

    const asNumber = (value: unknown, fallback = 0): number =>
      typeof value === 'number' && !Number.isNaN(value) ? value : fallback;

    const asNullableString = (value: unknown): string | null =>
      typeof value === 'string' ? value : null;

    const asNullableNumber = (value: unknown): number | null =>
      typeof value === 'number' && !Number.isNaN(value) ? value : null;

    const asBoolean = (value: unknown): boolean => Boolean(value);

    const services = data.services.map((svc) => {
      const serviceId = asString(svc.service_id, 'unknown');
      const label = asString(svc.label, serviceId);
      const environments = Array.isArray(svc.environments)
        ? svc.environments.map((env) => {
            const envId = asString(env.environment_id, 'unknown');
            return new ServiceEnvironment(
              asString(env.service_key, `${serviceId}:${envId}`),
              envId,
              asString(env.environment, 'Unknown'),
              asBoolean(env.active),
              asNullableString(env.claimed_by),
              asNullableNumber(env.claimed_by_id),
              asNullableString(env.claimed_at),
              asNullableString(env.expires_at),
              asBoolean(env.claimed_by_team),
            );
          })
        : [];
      return new Service(
        serviceId,
        label,
        asNumber(svc.default_minutes, 0),
        asNullableString(svc.owner),
        asNumber(svc.workspace_id, 0),
        asString(svc.workspace_name, 'Unknown'),
        environments,
      );
    });

    return new ServicesResponseDto(
      data.expiry_warning_minutes,
      data.auto_refresh_minutes,
      services,
    );
  }

  static async claim(
    serviceKey: string,
    teamName?: string | null,
  ): Promise<void> {
    const response = await ApiService.post('/api/claim', {
      service_key: serviceKey,
      claimed_by_label: teamName || null,
      claimed_by_team: Boolean(teamName),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error || 'Unable to claim service.');
    }
  }

  static async release(serviceKey: string): Promise<void> {
    const response = await ApiService.post('/api/release', {
      service_key: serviceKey,
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error || 'Unable to release service.');
    }
  }

  static async extend(serviceKey: string): Promise<void> {
    const response = await ApiService.post('/api/extend', {
      service_key: serviceKey,
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error || 'Unable to extend service.');
    }
  }
}
