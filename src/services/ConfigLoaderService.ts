import fs from 'fs';
import yaml from 'js-yaml';
import { ConfigService } from './ConfigService';
import { AppConfigDto } from '../dtos/AppConfigDto';

export class ConfigLoaderService {
  loadConfig(appConfigPath: string, servicesConfigPath: string): AppConfigDto {
    const appConfig = this.loadYaml(appConfigPath);
    const servicesConfig = this.loadYaml(servicesConfigPath);
    return new ConfigService(appConfig, servicesConfig).toDto();
  }

  private loadYaml(configPath: string): Record<string, unknown> {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.load(raw) as Record<string, unknown>;
    return parsed || {};
  }
}
