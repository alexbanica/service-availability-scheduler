import type { RowDataPacket } from 'mysql2/promise';
import { User } from '../entities/User';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type UserRow = RowDataPacket & {
  user_id: string;
  email: string;
  nickname: string;
};

export class UserRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.get<UserRow>(
      'SELECT user_id, email, nickname FROM users WHERE email = ?',
      [email],
    );
    if (!row) {
      return null;
    }
    return new User(row.user_id, row.email, row.nickname);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.get<UserRow>(
      'SELECT user_id, email, nickname FROM users WHERE user_id = ?',
      [id],
    );
    return row ? new User(row.user_id, row.email, row.nickname) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.all<UserRow>(
      `SELECT user_id, email, nickname FROM users WHERE user_id IN (${placeholders})`,
      ids,
    );
    return rows.map((row) => new User(row.user_id, row.email, row.nickname));
  }

  async insert(id: string, email: string, nickname: string): Promise<void> {
    await this.run(
      'INSERT INTO users (user_id, email, nickname) VALUES (?, ?, ?)',
      [id, email, nickname],
    );
  }
}
