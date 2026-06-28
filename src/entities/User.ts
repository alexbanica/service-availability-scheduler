export class User {
  public readonly id: string;

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly nickname: string,
  ) {
    this.id = userId;
  }
}
