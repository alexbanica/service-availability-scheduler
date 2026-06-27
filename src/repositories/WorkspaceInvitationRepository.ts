import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
  InvitationStatus,
  WorkspaceInvitation,
} from '../entities/WorkspaceInvitation';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type InvitationRow = RowDataPacket & {
  invitation_id: string;
  workspace_id: string;
  invited_user_id: string;
  invited_by_user_id: string;
  status: InvitationStatus;
  created_at: string | Date;
};

export class WorkspaceInvitationRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async insert(
    invitationId: string,
    workspaceId: string,
    invitedUserId: string,
    invitedByUserId: string,
  ): Promise<WorkspaceInvitation> {
    await this.db.query<ResultSetHeader>(
      `INSERT INTO workspace_invitations
       (invitation_id, workspace_id, invited_user_id, invited_by_user_id)
       VALUES (?, ?, ?, ?)`,
      [invitationId, workspaceId, invitedUserId, invitedByUserId],
    );
    return new WorkspaceInvitation(
      invitationId,
      workspaceId,
      invitedUserId,
      invitedByUserId,
      'pending',
      new Date(),
    );
  }

  async getByWorkspaceUser(
    workspaceId: string,
    userId: string,
  ): Promise<InvitationRow | null> {
    const row = await this.get<InvitationRow>(
      `SELECT invitation_id, workspace_id, invited_user_id,
              invited_by_user_id, status, created_at
       FROM workspace_invitations
       WHERE workspace_id = ? AND invited_user_id = ?`,
      [workspaceId, userId],
    );
    return row || null;
  }
}
