import type { RowDataPacket } from 'mysql2/promise';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type UserRoleRow = RowDataPacket & {
  user_id: string;
  role: string;
};

export class UserRoleRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  withConnection(connection: MysqlConnection): UserRoleRepository {
    return new UserRoleRepository(connection);
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const row = await this.get<UserRoleRow>(
      'SELECT user_id, role FROM user_roles WHERE user_id = ? AND role = ?',
      [userId, 'platform_admin'],
    );
    return Boolean(row);
  }

  async grantPlatformAdmin(userId: string): Promise<void> {
    await this.run(
      `INSERT INTO user_roles (user_id, role)
       VALUES (?, 'platform_admin')
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id)`,
      [userId],
    );
  }
}
