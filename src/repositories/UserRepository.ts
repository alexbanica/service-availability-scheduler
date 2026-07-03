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
  password_hash: string | null;
  google_subject: string | null;
  activated_at: string | Date | null;
};

export type UserWithPasswordHash = User & {
  passwordHash: string | null;
};

export class UserRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.get<UserRow>(
      'SELECT user_id, email, nickname, google_subject, activated_at FROM users WHERE email = ?',
      [email],
    );
    if (!row) {
      return null;
    }
    return this.mapRowToUser(row);
  }

  async findByEmailWithPasswordHash(
    email: string,
  ): Promise<UserWithPasswordHash | null> {
    const row = await this.get<UserRow>(
      'SELECT user_id, email, nickname, password_hash, google_subject, activated_at FROM users WHERE email = ?',
      [email],
    );
    if (!row) {
      return null;
    }

    const user = new User(
      row.user_id,
      row.email,
      row.nickname,
      row.activated_at,
      row.google_subject,
    ) as UserWithPasswordHash;
    user.passwordHash = row.password_hash;
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.get<UserRow>(
      'SELECT user_id, email, nickname, google_subject, activated_at FROM users WHERE user_id = ?',
      [id],
    );
    return row ? this.mapRowToUser(row) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.all<UserRow>(
      `SELECT user_id, email, nickname, google_subject, activated_at FROM users WHERE user_id IN (${placeholders})`,
      ids,
    );
    return rows.map((row) => this.mapRowToUser(row));
  }

  async findByGoogleSubject(googleSubject: string): Promise<User | null> {
    const row = await this.get<UserRow>(
      'SELECT user_id, email, nickname, google_subject, activated_at FROM users WHERE google_subject = ?',
      [googleSubject],
    );
    return row ? this.mapRowToUser(row) : null;
  }

  async insert(id: string, email: string, nickname: string): Promise<void> {
    await this.run(
      'INSERT INTO users (user_id, email, nickname, activated_at) VALUES (?, ?, ?, NULL)',
      [id, email, nickname],
    );
  }

  async insertWithPasswordHash(
    id: string,
    email: string,
    nickname: string,
    passwordHash: string | null,
    activatedAt: Date | null,
    googleSubject: string | null = null,
  ): Promise<void> {
    await this.run(
      'INSERT INTO users (user_id, email, nickname, password_hash, google_subject, activated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, nickname, passwordHash, googleSubject, activatedAt],
    );
  }

  async linkGoogleSubjectToUser(
    userId: string,
    googleSubject: string,
  ): Promise<void> {
    const result = await this.run(
      `UPDATE users
       SET google_subject = ?
       WHERE user_id = ?
         AND (google_subject IS NULL OR google_subject = ?)`,
      [googleSubject, userId, googleSubject],
    );
    if (result.affectedRows === 0) {
      throw new Error('Google subject already linked for user');
    }
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [
      passwordHash,
      userId,
    ]);
  }

  async setActivated(userId: string, activatedAt: Date | null): Promise<void> {
    await this.run('UPDATE users SET activated_at = ? WHERE user_id = ?', [
      activatedAt,
      userId,
    ]);
  }

  private mapRowToUser(row: UserRow): User {
    return new User(
      row.user_id,
      row.email,
      row.nickname,
      row.activated_at,
      row.google_subject,
    );
  }
}
