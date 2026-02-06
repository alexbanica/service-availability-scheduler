import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { Workspace } from '../entities/Workspace';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type WorkspaceRow = RowDataPacket & {
  id: number;
  name: string;
  admin_user_id: number;
};

export class WorkspaceRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async insert(name: string, adminUserId: number): Promise<Workspace> {
    const [result] = await this.db.query<ResultSetHeader>(
      'INSERT INTO workspaces (name, admin_user_id) VALUES (?, ?)',
      [name, adminUserId],
    );
    return new Workspace(result.insertId, name, adminUserId);
  }

  async findById(id: number): Promise<Workspace | null> {
    const row = await this.get<WorkspaceRow>(
      'SELECT id, name, admin_user_id FROM workspaces WHERE id = ?',
      [id],
    );
    return row ? new Workspace(row.id, row.name, row.admin_user_id) : null;
  }

  async listByUser(userId: number): Promise<Workspace[]> {
    const rows = await this.all<WorkspaceRow>(
      `SELECT w.id, w.name, w.admin_user_id
       FROM workspaces w
       INNER JOIN workspace_users wu ON wu.workspace_id = w.id
       WHERE wu.user_id = ?
       ORDER BY w.name`,
      [userId],
    );
    return rows.map(
      (row) => new Workspace(row.id, row.name, row.admin_user_id),
    );
  }

  async countByAdmin(adminUserId: number): Promise<number> {
    const row = await this.get<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM workspaces WHERE admin_user_id = ?',
      [adminUserId],
    );
    return Number(row?.total || 0);
  }
}
