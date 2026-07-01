import type { RowDataPacket } from 'mysql2/promise';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';
import { WorkspaceRole } from '../entities/Workspace';

type WorkspaceUserRow = RowDataPacket & {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
};

export class WorkspaceUserRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  withConnection(connection: MysqlConnection): WorkspaceUserRepository {
    return new WorkspaceUserRepository(connection);
  }

  async insert(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    await this.run(
      'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspaceId, userId, role],
    );
  }

  async getRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | null> {
    const row = await this.get<WorkspaceUserRow>(
      'SELECT workspace_id, user_id, role FROM workspace_users WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId],
    );
    return row ? row.role : null;
  }

  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const role = await this.getRole(workspaceId, userId);
    return role !== null;
  }

  async isAdmin(workspaceId: string, userId: string): Promise<boolean> {
    const role = await this.getRole(workspaceId, userId);
    return role === 'admin';
  }

  async isResourceAdmin(workspaceId: string, userId: string): Promise<boolean> {
    const role = await this.getRole(workspaceId, userId);
    return role === 'admin' || role === 'manager';
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    await this.run(
      'UPDATE workspace_users SET role = ? WHERE workspace_id = ? AND user_id = ?',
      [role, workspaceId, userId],
    );
  }

  async remove(workspaceId: string, userId: string): Promise<boolean> {
    const result = await this.run(
      'DELETE FROM workspace_users WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId],
    );
    return result.affectedRows > 0;
  }

  async countAdmins(workspaceId: string): Promise<number> {
    const row = await this.get<RowDataPacket & { total: number }>(
      'SELECT COUNT(*) AS total FROM workspace_users WHERE workspace_id = ? AND role = \'admin\'',
      [workspaceId],
    );
    return Number(row?.total || 0);
  }
}
