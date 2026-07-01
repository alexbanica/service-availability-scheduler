import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
  InvitationStatus,
  WorkspaceInvitation,
} from '../entities/WorkspaceInvitation';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';
import { createHash } from 'node:crypto';

type WorkspaceInvitationRow = RowDataPacket & {
  invitation_id: string;
  workspace_id: string;
  invited_user_id: string | null;
  invited_by_user_id: string;
  invited_email: string;
  invitation_code_hash: string;
  status: InvitationStatus;
  expires_at: string | Date;
  accepted_at: string | Date | null;
  consumed_at: string | Date | null;
  created_at: string | Date;
};

type WorkspaceInvitationQueryResult = Omit<
  WorkspaceInvitationRow,
  'invitation_code_hash'
> & {
  invitationCodeHash: string;
};

export class WorkspaceInvitationRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  withConnection(connection: MysqlConnection): WorkspaceInvitationRepository {
    return new WorkspaceInvitationRepository(connection);
  }

  async insert(
    invitationId: string,
    workspaceId: string,
    invitedUserId: string | null,
    invitedByUserId: string,
    invitedEmail?: string,
    invitationCodeHash?: string,
    expiresAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000),
  ): Promise<WorkspaceInvitation> {
    const resolvedInvitedEmail = this.normalizeInvitedEmail(invitedEmail);
    const finalInvitationCodeHash =
      invitationCodeHash ??
      this.buildFallbackInvitationCodeHash(
        invitationId,
        workspaceId,
        invitedByUserId,
        resolvedInvitedEmail || '',
      );

    const resolvedEmail = await this.resolveInvitedEmail(
      resolvedInvitedEmail,
      invitedUserId,
    );
    if (!resolvedEmail) {
      throw new Error('Invited email required');
    }

    await this.db.query<ResultSetHeader>(
      `INSERT INTO workspace_invitations
       (invitation_id, workspace_id, invited_user_id,
        invited_by_user_id, invited_email, invitation_code_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        invitationId,
        workspaceId,
        invitedUserId,
        invitedByUserId,
        resolvedEmail,
        finalInvitationCodeHash,
        expiresAt,
      ],
    );

    return new WorkspaceInvitation(
      invitationId,
      workspaceId,
      invitedUserId,
      invitedByUserId,
      'pending',
      new Date(),
      resolvedEmail,
      finalInvitationCodeHash,
      expiresAt,
    );
  }

  async getByWorkspaceUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceInvitationQueryResult | null> {
    const row = await this.get<WorkspaceInvitationRow>(
      `SELECT
         invitation_id,
         workspace_id,
         invited_user_id,
         invited_by_user_id,
         invited_email,
         invitation_code_hash,
         status,
         expires_at,
         accepted_at,
         consumed_at,
         created_at
       FROM workspace_invitations
       WHERE workspace_id = ? AND invited_user_id = ?`,
      [workspaceId, userId],
    );
    return row ? this.mapRowToResult(row) : null;
  }

  async findLatestByWorkspaceAndEmail(
    workspaceId: string,
    invitedEmail: string,
  ): Promise<WorkspaceInvitation | null> {
    const normalizedInvitedEmail = this.normalizeInvitedEmail(invitedEmail);
    if (!normalizedInvitedEmail) {
      return null;
    }

    const row = await this.get<WorkspaceInvitationRow>(
      `SELECT
         invitation_id,
         workspace_id,
         invited_user_id,
         invited_by_user_id,
         invited_email,
         invitation_code_hash,
         status,
         expires_at,
         accepted_at,
         consumed_at,
         created_at
       FROM workspace_invitations
       WHERE workspace_id = ?
         AND invited_email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [workspaceId, normalizedInvitedEmail],
    );

    return row ? this.mapRowToEntity(row) : null;
  }

  async findPendingValidByCodeHash(
    invitationCodeHash: string,
    now: Date,
  ): Promise<WorkspaceInvitation | null> {
    const row = await this.get<WorkspaceInvitationRow>(
      `SELECT
         invitation_id,
         workspace_id,
         invited_user_id,
         invited_by_user_id,
         invited_email,
         invitation_code_hash,
         status,
         expires_at,
         accepted_at,
         consumed_at,
         created_at
       FROM workspace_invitations
       WHERE invitation_code_hash = ?
         AND status = 'pending'
         AND expires_at > ?
       LIMIT 1`,
      [invitationCodeHash, now],
    );
    return row ? this.mapRowToEntity(row) : null;
  }

  async findLatestByCodeHash(
    invitationCodeHash: string,
  ): Promise<WorkspaceInvitation | null> {
    const row = await this.get<WorkspaceInvitationRow>(
      `SELECT
         invitation_id,
         workspace_id,
         invited_user_id,
         invited_by_user_id,
         invited_email,
         invitation_code_hash,
         status,
         expires_at,
         accepted_at,
         consumed_at,
         created_at
       FROM workspace_invitations
       WHERE invitation_code_hash = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [invitationCodeHash],
    );
    return row ? this.mapRowToEntity(row) : null;
  }

  async findLatestByCodeHashForUpdate(
    invitationCodeHash: string,
  ): Promise<WorkspaceInvitation | null> {
    const row = await this.get<WorkspaceInvitationRow>(
      `SELECT
         invitation_id,
         workspace_id,
         invited_user_id,
         invited_by_user_id,
         invited_email,
         invitation_code_hash,
         status,
         expires_at,
         accepted_at,
         consumed_at,
         created_at
       FROM workspace_invitations
       WHERE invitation_code_hash = ?
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [invitationCodeHash],
    );
    return row ? this.mapRowToEntity(row) : null;
  }

  async listPendingByWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const rows = await this.all<WorkspaceInvitationRow>(
      `SELECT
         invitation_id,
         workspace_id,
         invited_user_id,
         invited_by_user_id,
         invited_email,
         invitation_code_hash,
         status,
         expires_at,
         accepted_at,
         consumed_at,
         created_at
       FROM workspace_invitations
       WHERE workspace_id = ?
         AND status = 'pending'
       ORDER BY created_at DESC`,
      [workspaceId],
    );
    return rows.map((row) => this.mapRowToEntity(row));
  }

  async listExpiredByWorkspace(
    workspaceId: string,
    now: Date,
  ): Promise<WorkspaceInvitation[]> {
    const rows = await this.all<WorkspaceInvitationRow>(
      `SELECT
         invitation_id,
         workspace_id,
         invited_user_id,
         invited_by_user_id,
         invited_email,
         invitation_code_hash,
         status,
         expires_at,
         accepted_at,
         consumed_at,
         created_at
       FROM workspace_invitations
       WHERE workspace_id = ?
         AND status = 'pending'
         AND expires_at <= ?
       ORDER BY expires_at ASC, created_at DESC`,
      [workspaceId, now],
    );
    return rows.map((row) => this.mapRowToEntity(row));
  }

  async markAccepted(
    invitationId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.run(
      `UPDATE workspace_invitations
       SET status = 'accepted',
           accepted_at = ?,
           consumed_at = COALESCE(consumed_at, ?)
       WHERE invitation_id = ?
         AND status = 'pending'`,
      [now, now, invitationId],
    );
    return result.affectedRows > 0;
  }

  async markAcceptedWithInvitedUser(
    invitationId: string,
    invitedUserId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.run(
      `UPDATE workspace_invitations
       SET status = 'accepted',
           invited_user_id = ?,
           accepted_at = ?,
           consumed_at = COALESCE(consumed_at, ?)
       WHERE invitation_id = ?
         AND status = 'pending'`,
      [invitedUserId, now, now, invitationId],
    );
    return result.affectedRows > 0;
  }

  async markConsumed(
    invitationId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.run(
      `UPDATE workspace_invitations
       SET consumed_at = ?,
           status = 'revoked'
       WHERE invitation_id = ?
         AND status = 'pending'`,
      [now, invitationId],
    );
    return result.affectedRows > 0;
  }

  async markConsumedByWorkspace(
    workspaceId: string,
    invitationId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.run(
      `UPDATE workspace_invitations
       SET consumed_at = ?,
           status = 'revoked'
       WHERE workspace_id = ?
         AND invitation_id = ?
         AND status = 'pending'`,
      [now, workspaceId, invitationId],
    );
    return result.affectedRows > 0;
  }

  private async resolveInvitedEmail(
    invitedEmail: string | null,
    invitedUserId: string | null,
  ): Promise<string | null> {
    if (invitedEmail) {
      return invitedEmail;
    }

    if (!invitedUserId) {
      return null;
    }

    const user = await this.get<RowDataPacket & { email: string }>(
      'SELECT email FROM users WHERE user_id = ?',
      [invitedUserId],
    );
    if (!user) {
      return null;
    }
    return this.normalizeInvitedEmail(user.email);
  }

  private buildFallbackInvitationCodeHash(
    invitationId: string,
    workspaceId: string,
    inviterUserId: string,
    invitedEmail: string,
  ): string {
    return createHash('sha256')
      .update([invitationId, workspaceId, inviterUserId, invitedEmail].join('|'))
      .digest('hex');
  }

  private normalizeInvitedEmail(invitedEmail: string | undefined | null): string {
    return (invitedEmail || '').trim().toLowerCase();
  }

  private mapRowToEntity(row: WorkspaceInvitationRow): WorkspaceInvitation {
    return new WorkspaceInvitation(
      row.invitation_id,
      row.workspace_id,
      row.invited_user_id,
      row.invited_by_user_id,
      row.status,
      row.created_at,
      row.invited_email,
      row.invitation_code_hash,
      row.expires_at,
      row.accepted_at,
      row.consumed_at,
    );
  }

  private mapRowToResult(
    row: WorkspaceInvitationRow,
  ): WorkspaceInvitationQueryResult {
    return {
      invitation_id: row.invitation_id,
      workspace_id: row.workspace_id,
      invited_user_id: row.invited_user_id,
      invited_by_user_id: row.invited_by_user_id,
      invited_email: row.invited_email,
      status: row.status,
      invitationCodeHash: row.invitation_code_hash,
      expires_at: row.expires_at,
      accepted_at: row.accepted_at,
      consumed_at: row.consumed_at,
      created_at: row.created_at,
    };
  }
}
