export class ServiceDefinition {
  constructor(
    public readonly key: string,
    public readonly environmentId: string,
    public readonly environment: string,
    public readonly id: string,
    public readonly label: string,
    public readonly defaultMinutes: number,
    public readonly owner: string | null,
    public readonly workspaceId: number,
    public readonly workspaceName: string,
  ) {}
}
