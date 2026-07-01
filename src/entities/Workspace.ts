export type WorkspaceRole = 'admin' | 'manager' | 'member';

export class Workspace {
  public readonly id: string;

  constructor(
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly adminUserId: string,
    public readonly userCount: number = 0,
    public readonly serviceCount: number = 0,
    public readonly ownerCount: number = 0,
    public readonly environmentCount: number = 0,
    public readonly currentUserRole: WorkspaceRole = 'member',
  ) {
    this.id = workspaceId;
  }
}
