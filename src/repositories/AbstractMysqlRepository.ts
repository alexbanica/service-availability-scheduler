import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export type MysqlConnection = Pool | PoolConnection;

export abstract class AbstractMysqlRepository {
  constructor(protected readonly db: MysqlConnection) {}

  protected async get<T extends RowDataPacket>(
    sql: string,
    params: Array<unknown> = [],
  ): Promise<T | null> {
    const [rows] = await this.db.query<T[]>(sql, params);
    return rows[0] || null;
  }

  protected async all<T extends RowDataPacket>(
    sql: string,
    params: Array<unknown> = [],
  ): Promise<T[]> {
    const [rows] = await this.db.query<T[]>(sql, params);
    return rows;
  }

  protected async run(sql: string, params: Array<unknown> = []): Promise<void> {
    await this.db.query(sql, params);
  }
}
