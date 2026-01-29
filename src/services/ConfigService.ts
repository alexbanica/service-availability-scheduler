import {
  AppConfigDto,
  EnvironmentConfigDto,
  ServiceConfigDto,
} from '../dtos/AppConfigDto';

export class ConfigService {
  constructor(
    private readonly appConfig: Record<string, unknown>,
    private readonly servicesConfig: Record<string, unknown>,
  ) {}

  toDto(): AppConfigDto {
    const expiryWarningMinutes = Number(
      this.appConfig.expiry_warning_minutes ?? 5,
    );
    const autoRefreshMinutes = Number(
      this.appConfig.auto_refresh_minutes ?? 2,
    );
    const servicesRaw = Array.isArray(this.servicesConfig.services)
      ? (this.servicesConfig.services as Array<Record<string, unknown>>)
      : [];

    const services = servicesRaw.map((svc: Record<string, unknown>) => {
      const id = typeof svc.id === 'string' ? svc.id : 'unknown';
      const label = typeof svc.label === 'string' ? svc.label : null;
      const defaultMinutes = Number(svc.default_minutes ?? 30);
      const owner = typeof svc.owner === 'string' ? svc.owner : null;
      const envs = Array.isArray(svc.environments)
        ? (svc.environments as Array<Record<string, unknown>>)
        : [];
      const environments = envs.map((env) => {
        const envId = typeof env.id === 'string' ? env.id : 'unknown';
        const envName = typeof env.name === 'string' ? env.name : 'Unknown';
        return new EnvironmentConfigDto(envId, envName);
      });
      return new ServiceConfigDto(
        id,
        label,
        defaultMinutes,
        owner,
        environments,
      );
    });

    return new AppConfigDto(
      expiryWarningMinutes,
      autoRefreshMinutes,
      services,
    );
  }
}
