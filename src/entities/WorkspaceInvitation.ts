export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export class WorkspaceInvitation {
  constructor(
    public readonly invitationId: string,
    public readonly workspaceId: string,
    public readonly invitedUserId: string,
    public readonly invitedByUserId: string,
    public readonly status: InvitationStatus,
    public readonly createdAt: string | Date,
  ) {}
}
