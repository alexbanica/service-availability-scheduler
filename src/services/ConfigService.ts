import {
  AppConfigDto,
  EnvironmentConfigDto,
  ServiceConfigDto,
  SlackConfigDto,
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
    const autoRefreshMinutes = Number(this.appConfig.auto_refresh_minutes ?? 2);
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

    const slackConfig =
      typeof this.appConfig.slack === 'object' && this.appConfig.slack
        ? (this.appConfig.slack as Record<string, unknown>)
        : {};
    const slackEnabled = this.readBoolean(
      process.env.SLACK_ENABLED,
      slackConfig.enabled,
      false,
    );
    const slackToken = this.readString(
      process.env.SLACK_BOT_TOKEN,
      slackConfig.bot_token,
    );
    const slackIntervalSeconds = this.readNumber(
      process.env.SLACK_NOTIFY_INTERVAL_SECONDS,
      slackConfig.notify_interval_seconds,
      60,
    );

    const slack = new SlackConfigDto(
      slackEnabled,
      slackToken,
      slackIntervalSeconds,
    );

    return new AppConfigDto(
      expiryWarningMinutes,
      autoRefreshMinutes,
      services,
      slack,
    );
  }

  private readString(
    envValue: string | undefined,
    rawValue: unknown,
  ): string | null {
    if (envValue !== undefined && envValue !== '') {
      return envValue;
    }
    if (typeof rawValue === 'string' && rawValue !== '') {
      return rawValue;
    }
    return null;
  }

  private readNumber(
    envValue: string | undefined,
    rawValue: unknown,
    fallback: number,
  ): number {
    if (envValue !== undefined && envValue !== '') {
      const parsed = Number(envValue);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readBoolean(
    envValue: string | undefined,
    rawValue: unknown,
    fallback: boolean,
  ): boolean {
    if (envValue !== undefined && envValue !== '') {
      return envValue === 'true' || envValue === '1';
    }
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }
    if (typeof rawValue === 'string') {
      return rawValue === 'true' || rawValue === '1';
    }
    return fallback;
  }
}
