export class AppConfigDto {
  constructor(
    public readonly expiryWarningMinutes: number,
    public readonly autoRefreshMinutes: number,
    public readonly services: ServiceConfigDto[],
  ) {}
}

export class EnvironmentConfigDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}

export class ServiceConfigDto {
  constructor(
    public readonly id: string,
    public readonly label: string | null,
    public readonly defaultMinutes: number,
    public readonly owner: string | null,
    public readonly environments: EnvironmentConfigDto[],
  ) {}
}
