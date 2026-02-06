import { AppConfigDto } from '../dtos/AppConfigDto';
import { ServiceDefinition } from '../entities/ServiceDefinition';

export class ServiceCatalogService {
  buildServiceList(config: AppConfigDto): ServiceDefinition[] {
    const services: ServiceDefinition[] = [];
    config.services.forEach((svc) => {
      svc.environments.forEach((env) => {
        services.push(
          new ServiceDefinition(
            `${svc.id}:${env.id}`,
            svc.id,
            svc.label || svc.id,
            env.id,
            env.name,
            svc.defaultMinutes,
            svc.owner,
            0,
            'Unassigned',
          ),
        );
      });
    });
    return services;
  }
}
