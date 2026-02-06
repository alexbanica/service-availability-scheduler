export class ServiceEnvironment {
  constructor(
    public readonly serviceKey: string,
    public readonly environmentId: string,
    public readonly environment: string,
    public readonly active: boolean,
    public readonly claimedBy: string | null,
    public readonly claimedById: number | null,
    public readonly claimedAt: string | null,
    public readonly expiresAt: string | null,
    public readonly claimedByTeam: boolean,
  ) {}
}

export class Service {
  constructor(
    public readonly serviceId: string,
    public readonly label: string,
    public readonly defaultMinutes: number,
    public readonly owner: string | null,
    public readonly workspaceId: number,
    public readonly workspaceName: string,
    public readonly environments: ServiceEnvironment[],
  ) {}
}
