export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly nickname: string,
    public readonly activated: boolean = false,
  ) {
    // no-op
  }
}
