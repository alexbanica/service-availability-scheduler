export class Workspace {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly adminUserId: string,
    public readonly userCount: number = 0,
    public readonly serviceCount: number = 0,
    public readonly ownerCount: number = 0,
    public readonly environmentCount: number = 0,
  ) {}
}
