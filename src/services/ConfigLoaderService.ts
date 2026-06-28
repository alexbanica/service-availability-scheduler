import fs from 'fs';
import yaml from 'js-yaml';
export type AppConfig = {
  expiryWarningMinutes: number;
  autoRefreshSeconds: number;
};

export class ConfigLoaderService {
  loadConfig(appConfigPath: string): AppConfig {
    const appConfig = this.loadYaml(appConfigPath);
    const expiryWarningMinutes = Number(appConfig.expiry_warning_minutes ?? 5);
    const autoRefreshSeconds = Number(appConfig.auto_refresh_seconds ?? 60);
    return { expiryWarningMinutes, autoRefreshSeconds };
  }

  private loadYaml(configPath: string): Record<string, unknown> {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.load(raw) as Record<string, unknown>;
    return parsed || {};
  }
}
