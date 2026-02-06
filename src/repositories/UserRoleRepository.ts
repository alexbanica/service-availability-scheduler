import type { RowDataPacket } from 'mysql2/promise';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type UserRoleRow = RowDataPacket & {
  user_id: number;
  role: string;
};

export class UserRoleRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async isPlatformAdmin(userId: number): Promise<boolean> {
    const row = await this.get<UserRoleRow>(
      'SELECT user_id, role FROM user_roles WHERE user_id = ? AND role = ?',
      [userId, 'platform_admin'],
    );
    return Boolean(row);
  }
}
