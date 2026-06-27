export class Workspace {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly adminUserId: number,
    public readonly userCount: number = 0,
    public readonly serviceCount: number = 0,
  ) {}
}
