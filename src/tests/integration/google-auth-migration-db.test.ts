// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { runPendingMigrations } from '../../db';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const ALLOW_TRUNCATE = process.env.TEST_DATABASE_ALLOW_TRUNCATE === '1';

type SchemaColumn = RowDataPacket & {
  COLUMN_NAME: string;
};

type UniqueIndex = RowDataPacket & {
  INDEX_NAME: string;
  NON_UNIQUE: number | string;
  COLUMN_NAME: string;
};

async function createDb(): Promise<mysql.Pool> {
  return mysql.createPool({
    uri: TEST_DATABASE_URL,
    dateStrings: true,
    timezone: 'Z',
    multipleStatements: true,
  });
}

async function ensureSchema(db: mysql.Pool): Promise<void> {
  const schemaDir = path.join(process.cwd(), 'config', 'schema');
  const entries = await fs.readdir(schemaDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(schemaDir, file), 'utf8');
    if (sql.trim()) {
      await db.query(sql);
    }
  }
}

function containsColumn(rows: SchemaColumn[], name: string): boolean {
  return rows.some((row) => row.COLUMN_NAME === name);
}

async function hasGoogleSubjectUniqueIndex(
  db: mysql.Pool,
): Promise<boolean> {
  const [rows] = await db.query<UniqueIndex[]>(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'google_subject'`,
  );

  if (!rows.length) {
    return false;
  }

  return rows.some((row) => Number(row.NON_UNIQUE) === 0);
}

test(
  'users table has google_subject column and unique constraint after migrations',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createDb();

    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DROP TABLE IF EXISTS users');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');

      await ensureSchema(db);
      await runPendingMigrations(db);
      const [columnRows] = await db.query<SchemaColumn[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'users'`,
      );
      assert.equal(containsColumn(columnRows, 'google_subject'), true);
      assert.equal(
        await hasGoogleSubjectUniqueIndex(db),
        true,
        'Expected users.google_subject to have unique index',
      );
    } finally {
      await db.end();
    }
  },
);

test(
  'database enforces one user per google_subject',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createDb();

    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DROP TABLE IF EXISTS users');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');

      await ensureSchema(db);
      await runPendingMigrations(db);
      const subject = 'google-subject-dup';

      await db.query(
        `INSERT INTO users
           (user_id, email, nickname, password_hash, google_subject)
         VALUES
           (?, ?, ?, ?, ?)`,
        [
          '11111111-1111-1111-1111-111111111111',
          'alpha@example.com',
          'Alpha',
          'hash-1',
          subject,
        ],
      );

      let duplicateRejected = false;
      try {
        await db.query(
          `INSERT INTO users
             (user_id, email, nickname, password_hash, google_subject)
           VALUES
             (?, ?, ?, ?, ?)`,
          [
            '22222222-2222-2222-2222-222222222222',
            'beta@example.com',
            'Beta',
            'hash-2',
            subject,
          ],
        );
      } catch (error) {
        duplicateRejected = true;
        assert.equal((error as { code?: string }).code, 'ER_DUP_ENTRY');
      }

      assert.equal(
        duplicateRejected,
        true,
        'Expected duplicate google_subject insert to fail',
      );
    } finally {
      await db.end();
    }
  },
);
