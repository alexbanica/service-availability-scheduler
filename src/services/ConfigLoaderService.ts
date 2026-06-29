import fs from 'node:fs';
import yaml from 'js-yaml';

export type AppConfig = {
  expiryWarningMinutes: number;
  autoRefreshSeconds: number;
  jwtExpiresInSeconds: number;
  passwordResetTokenExpiresInSeconds: number;
};

export class ConfigLoaderService {
  loadConfig(appConfigPath: string): AppConfig {
    const appConfig = this.loadYaml(appConfigPath);
    const expiryWarningMinutes = Number(appConfig.expiry_warning_minutes ?? 5);
    const autoRefreshSeconds = Number(appConfig.auto_refresh_seconds ?? 60);
    const jwtExpiresInSeconds = this.resolveJwtExpiresInSeconds(appConfig);
    const passwordResetTokenExpiresInSeconds =
      this.resolvePasswordResetTokenExpiresInSeconds(appConfig);

    return {
      expiryWarningMinutes,
      autoRefreshSeconds,
      jwtExpiresInSeconds,
      passwordResetTokenExpiresInSeconds,
    };
  }

  private resolveJwtExpiresInSeconds(
    appConfig: Record<string, unknown>,
  ): number {
    const envValue = process.env.JWT_EXPIRES_IN_SECONDS;
    if (envValue !== undefined) {
      const envJwtExpiry = Number(envValue);
      if (!Number.isFinite(envJwtExpiry) || envJwtExpiry <= 0) {
        throw new Error(`Invalid JWT_EXPIRES_IN_SECONDS value: ${envValue}`);
      }
      return envJwtExpiry;
    }

    const rawFileValue = appConfig.jwt_expires_in_seconds;
    if (rawFileValue === undefined) {
      return 3600;
    }

    const fileJwtExpiry = Number(rawFileValue);
    if (!Number.isFinite(fileJwtExpiry) || fileJwtExpiry <= 0) {
      throw new Error(
        `Invalid jwt_expires_in_seconds value: ${String(rawFileValue)}`,
      );
    }
    return fileJwtExpiry;
  }

  private resolvePasswordResetTokenExpiresInSeconds(
    appConfig: Record<string, unknown>,
  ): number {
    const envValue = process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
    if (envValue !== undefined) {
      const envValueAsNumber = Number(envValue);
      if (!Number.isFinite(envValueAsNumber) || envValueAsNumber <= 0) {
        throw new Error(
          `Invalid PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS value: ${envValue}`,
        );
      }
      return envValueAsNumber;
    }

    const rawFileValue = appConfig.password_reset_token_expires_in_seconds;
    if (rawFileValue === undefined) {
      return 3600;
    }

    const fileValue = Number(rawFileValue);
    if (!Number.isFinite(fileValue) || fileValue <= 0) {
      throw new Error(
        `Invalid password_reset_token_expires_in_seconds value: ${String(
          rawFileValue,
        )}`,
      );
    }
    return fileValue;
  }

  private loadYaml(configPath: string): Record<string, unknown> {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.load(raw) as Record<string, unknown>;
    return parsed || {};
  }
}
