import { ServiceStatusDto } from './ServiceStatusDto';

export class ServiceListDto {
  constructor(
    public readonly expiryWarningMinutes: number,
    public readonly autoRefreshSeconds: number,
    public readonly services: ServiceStatusDto[],
  ) {}
}
