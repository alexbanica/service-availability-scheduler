import type { RowDataPacket } from 'mysql2/promise';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type WorkspaceUserRow = RowDataPacket & {
  workspace_id: number;
  user_id: number;
  role: 'admin' | 'member';
};

export class WorkspaceUserRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async insert(
    workspaceId: number,
    userId: number,
    role: 'admin' | 'member',
  ): Promise<void> {
    await this.run(
      'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspaceId, userId, role],
    );
  }

  async isMember(workspaceId: number, userId: number): Promise<boolean> {
    const row = await this.get<WorkspaceUserRow>(
      'SELECT workspace_id, user_id, role FROM workspace_users WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId],
    );
    return Boolean(row);
  }

  async isAdmin(workspaceId: number, userId: number): Promise<boolean> {
    const row = await this.get<WorkspaceUserRow>(
      `SELECT workspace_id, user_id, role
       FROM workspace_users
       WHERE workspace_id = ? AND user_id = ? AND role = 'admin'`,
      [workspaceId, userId],
    );
    return Boolean(row);
  }
}
