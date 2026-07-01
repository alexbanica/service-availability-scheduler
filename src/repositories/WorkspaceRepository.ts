import type { RowDataPacket } from 'mysql2/promise';
import { Workspace, WorkspaceRole } from '../entities/Workspace';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type WorkspaceRow = RowDataPacket & {
  workspace_id: string;
  name: string;
  admin_user_id: string;
  current_user_role: WorkspaceRole;
  user_count: number;
  service_count: number;
  owner_count: number;
  environment_count: number;
};

export class WorkspaceRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  withConnection(connection: MysqlConnection): WorkspaceRepository {
    return new WorkspaceRepository(connection);
  }

  async insert(
    workspaceId: string,
    name: string,
    adminUserId: string,
  ): Promise<Workspace> {
    await this.run(
      'INSERT INTO workspaces (workspace_id, name, admin_user_id) VALUES (?, ?, ?)',
      [workspaceId, name, adminUserId],
    );
    return new Workspace(workspaceId, name, adminUserId, 1, 0, 0, 0);
  }

  async findById(workspaceId: string): Promise<Workspace | null> {
    const row = await this.get<WorkspaceRow>(
      `SELECT w.workspace_id,
              w.name,
              w.admin_user_id,
              'member' AS current_user_role,
              COUNT(DISTINCT wu.user_id) AS user_count,
              COUNT(DISTINCT s.service_id) AS service_count,
              COUNT(DISTINCT o.owner_id) AS owner_count,
              COUNT(DISTINCT e.environment_id) AS environment_count
       FROM workspaces w
       LEFT JOIN workspace_users wu ON wu.workspace_id = w.workspace_id
       LEFT JOIN services s ON s.workspace_id = w.workspace_id
       LEFT JOIN owners o ON o.workspace_id = w.workspace_id
       LEFT JOIN environments e ON e.workspace_id = w.workspace_id
       WHERE w.workspace_id = ?
       GROUP BY w.workspace_id, w.name, w.admin_user_id`,
      [workspaceId],
    );
    return row
      ? new Workspace(
          row.workspace_id,
          row.name,
          row.admin_user_id,
          Number(row.user_count),
          Number(row.service_count),
          Number(row.owner_count),
          Number(row.environment_count),
          row.current_user_role || 'member',
        )
      : null;
  }

  async listByUser(userId: string): Promise<Workspace[]> {
    const rows = await this.all<WorkspaceRow>(
      `SELECT w.workspace_id,
              w.name,
              w.admin_user_id,
              wu.role AS current_user_role,
              COUNT(DISTINCT wu_stats.user_id) AS user_count,
              COUNT(DISTINCT s.service_id) AS service_count,
              COUNT(DISTINCT o.owner_id) AS owner_count,
              COUNT(DISTINCT e.environment_id) AS environment_count
       FROM workspaces w
       INNER JOIN workspace_users wu
         ON wu.workspace_id = w.workspace_id
       LEFT JOIN workspace_users wu_stats
         ON wu_stats.workspace_id = w.workspace_id
       LEFT JOIN services s
         ON s.workspace_id = w.workspace_id
       LEFT JOIN owners o
         ON o.workspace_id = w.workspace_id
       LEFT JOIN environments e
         ON e.workspace_id = w.workspace_id
       WHERE wu.user_id = ?
       GROUP BY w.workspace_id, w.name, w.admin_user_id
       ORDER BY w.name`,
      [userId],
    );
    return rows.map(
      (row) =>
        new Workspace(
          row.workspace_id,
          row.name,
          row.admin_user_id,
          Number(row.user_count),
          Number(row.service_count),
          Number(row.owner_count),
          Number(row.environment_count),
          row.current_user_role || 'member',
        ),
    );
  }

  async countByAdmin(adminUserId: string): Promise<number> {
    const row = await this.get<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM workspaces WHERE admin_user_id = ?',
      [adminUserId],
    );
    return Number(row?.total || 0);
  }

  async listUsersByWorkspace(
    workspaceId: string,
  ): Promise<Array<{ userId: string; email: string }>> {
    const rows = await this.all<
      RowDataPacket & { user_id: string; email: string }
    >(
      `SELECT u.user_id, u.email
       FROM workspace_users wu
       INNER JOIN users u ON u.user_id = wu.user_id
       WHERE wu.workspace_id = ?
       ORDER BY u.email`,
      [workspaceId],
    );
    return rows.map((row) => ({ userId: row.user_id, email: row.email }));
  }

  async listUsersByWorkspaceWithRole(
    workspaceId: string,
  ): Promise<Array<{ userId: string; email: string; role: WorkspaceRole }>> {
    const rows = await this.all<
      RowDataPacket & { user_id: string; email: string; role: WorkspaceRole }
    >(
      `SELECT u.user_id, u.email, wu.role
       FROM workspace_users wu
       INNER JOIN users u ON u.user_id = wu.user_id
       WHERE wu.workspace_id = ?
       ORDER BY u.email`,
      [workspaceId],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      role: row.role,
    }));
  }
}
