export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export class WorkspaceInvitation {
  constructor(
    public readonly id: number,
    public readonly workspaceId: number,
    public readonly invitedUserId: number,
    public readonly invitedByUserId: number,
    public readonly status: InvitationStatus,
    public readonly createdAt: string | Date,
  ) {}
}
