export class User {
  public readonly id: string;
  public activatedAt: Date | null;
  public activated: boolean;

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly nickname: string,
    activatedAt: Date | string | null = null,
  ) {
    this.id = userId;
    this.activatedAt =
      activatedAt instanceof Date
        ? activatedAt
        : activatedAt
          ? new Date(activatedAt)
          : null;
    this.activated = Boolean(this.activatedAt);
  }
}
