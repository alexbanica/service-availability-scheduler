import { Service } from '../entities/Service.js';

export class ServicesResponseDto {
  constructor(
    public readonly expiryWarningMinutes: number,
    public readonly autoRefreshSeconds: number,
    public readonly services: Service[],
  ) {}
}
