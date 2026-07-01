export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export class WorkspaceInvitation {
  constructor(
    public readonly invitationId: string,
    public readonly workspaceId: string,
    public readonly invitedUserId: string | null,
    public readonly invitedByUserId: string,
    public readonly status: InvitationStatus,
    public readonly createdAt: string | Date,
    public readonly invitedEmail: string | null = null,
    public readonly invitationCodeHash: string | null = null,
    public readonly expiresAt: string | Date | null = null,
    public readonly acceptedAt: string | Date | null = null,
    public readonly consumedAt: string | Date | null = null,
  ) {}
}
