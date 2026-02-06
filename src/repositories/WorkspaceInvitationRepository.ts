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
  id: number;
  workspace_id: number;
  invited_user_id: number;
  invited_by_user_id: number;
  status: InvitationStatus;
  created_at: string | Date;
};

export class WorkspaceInvitationRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async insert(
    workspaceId: number,
    invitedUserId: number,
    invitedByUserId: number,
  ): Promise<WorkspaceInvitation> {
    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO workspace_invitations
       (workspace_id, invited_user_id, invited_by_user_id)
       VALUES (?, ?, ?)`,
      [workspaceId, invitedUserId, invitedByUserId],
    );
    return new WorkspaceInvitation(
      result.insertId,
      workspaceId,
      invitedUserId,
      invitedByUserId,
      'pending',
      new Date(),
    );
  }
}
