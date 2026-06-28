export class Reservation {
  public readonly id: string | null;

  constructor(
    public readonly reservationId: string | null,
    public readonly serviceKey: string,
    public readonly environmentName: string,
    public readonly serviceName: string,
    public readonly userId: string,
    public readonly claimedByLabel: string | null,
    public readonly claimedByTeam: boolean,
    public readonly claimedAt: string | Date,
    public readonly expiresAt: string | Date,
    public readonly releasedAt: string | Date | null,
  ) {
    this.id = reservationId;
  }
}
