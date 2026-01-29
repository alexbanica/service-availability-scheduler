import { AppConfigDto } from '../dtos/AppConfigDto';
import { ServiceDefinition } from '../entities/ServiceDefinition';

export class ServiceCatalogService {
  buildServiceList(config: AppConfigDto): ServiceDefinition[] {
    const services: ServiceDefinition[] = [];
    config.services.forEach((svc) => {
      svc.environments.forEach((env) => {
        services.push(
          new ServiceDefinition(
            `${env.id}:${svc.id}`,
            env.id,
            env.name,
            svc.id,
            svc.label || svc.id,
            svc.defaultMinutes,
            svc.owner,
          ),
        );
      });
    });
    return services;
  }
}
