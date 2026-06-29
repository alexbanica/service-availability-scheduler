// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import mysql, { RowDataPacket } from 'mysql2/promise';

import { ensureMigrationsTable, runPendingMigrations } from '../../db';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const ALLOW_TRUNCATE = process.env.TEST_DATABASE_ALLOW_TRUNCATE === '1';

type ColumnRow = RowDataPacket & {
  COLUMN_NAME: string;
};

type CountRow = RowDataPacket & {
  total: number;
};

async function createDb(): Promise<mysql.Pool> {
  return mysql.createPool({
    uri: TEST_DATABASE_URL,
    dateStrings: true,
    timezone: 'Z',
    multipleStatements: true,
  });
}

async function resetMigrationTables(db: mysql.Pool): Promise<void> {
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  await db.query('DROP TABLE IF EXISTS password_reset_tokens');
  await db.query('DROP TABLE IF EXISTS schema_migrations');
  await db.query('DROP TABLE IF EXISTS users');
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function createLegacyUsersTable(db: mysql.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE users (
      user_id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      nickname VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
}

async function getColumns(
  db: mysql.Pool,
  tableName: string,
): Promise<string[]> {
  const [rows] = await db.query<ColumnRow[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName],
  );
  return rows.map((row) => row.COLUMN_NAME);
}

async function countRows(db: mysql.Pool, tableName: string): Promise<number> {
  const [rows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM ${tableName}`,
  );
  return Number(rows[0]?.total || 0);
}

async function migrationRecorded(
  db: mysql.Pool,
  migrationId: string,
): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT migration_id
     FROM schema_migrations
     WHERE migration_id = ?`,
    [migrationId],
  );
  return rows.length > 0;
}

test(
  'migration runner repairs legacy password schema and records table-scoped migrations once',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createDb();
    try {
      await resetMigrationTables(db);
      await createLegacyUsersTable(db);
      await db.query(
        `INSERT INTO users (user_id, email, nickname)
         VALUES (?, ?, ?)`,
        ['user-1', 'legacy@example.com', 'Legacy'],
      );

      await runPendingMigrations(db);

      const userColumns = await getColumns(db, 'users');
      assert.ok(userColumns.includes('password_hash'));

      const tokenColumns = await getColumns(db, 'password_reset_tokens');
      assert.ok(tokenColumns.includes('token_hash'));
      assert.ok(tokenColumns.includes('invalidated_at'));

      assert.equal(await countRows(db, 'users'), 1);
      assert.equal(
        await migrationRecorded(db, '0001_users-password-hash_users'),
        true,
      );
      assert.equal(
        await migrationRecorded(
          db,
          '0002_password-reset-tokens-create-table_password_reset_tokens',
        ),
        true,
      );

      const recordedBefore = await countRows(db, 'schema_migrations');
      await runPendingMigrations(db);
      assert.equal(await countRows(db, 'schema_migrations'), recordedBefore);
      assert.equal(await countRows(db, 'users'), 1);
    } finally {
      await resetMigrationTables(db);
      await db.end();
    }
  },
);

test(
  'migration bootstrap can run without applying pending migrations so explicit job can apply them later',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createDb();
    try {
      await resetMigrationTables(db);
      await createLegacyUsersTable(db);

      await ensureMigrationsTable(db);
      assert.equal(await countRows(db, 'schema_migrations'), 0);
      assert.equal(
        (await getColumns(db, 'users')).includes('password_hash'),
        false,
      );

      await runPendingMigrations(db);

      assert.equal(
        (await getColumns(db, 'users')).includes('password_hash'),
        true,
      );
      assert.equal(await countRows(db, 'schema_migrations'), 2);
    } finally {
      await resetMigrationTables(db);
      await db.end();
    }
  },
);
