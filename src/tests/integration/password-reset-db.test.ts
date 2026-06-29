// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import mysql, { RowDataPacket } from 'mysql2/promise';

type ColumnRow = RowDataPacket & {
  COLUMN_NAME: string;
};

type TableExistsRow = RowDataPacket & {
  TABLE_NAME: string;
};

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const ALLOW_TRUNCATE = process.env.TEST_DATABASE_ALLOW_TRUNCATE === '1';

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

async function hasTable(db: mysql.Pool, tableName: string): Promise<boolean> {
  const [rows] = await db.query<TableExistsRow[]>(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return rows.length > 0;
}

async function getColumns(
  db: mysql.Pool,
  tableName: string,
): Promise<string[]> {
  const [rows] = await db.query<ColumnRow[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return rows.map((row) => row.COLUMN_NAME);
}

test(
  'users table includes credential hash storage column',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await mysql.createPool({
      uri: TEST_DATABASE_URL,
      dateStrings: true,
      timezone: 'Z',
      multipleStatements: true,
    });
    try {
      await ensureSchema(db);
      const userColumns = await getColumns(db, 'users');
      assert.ok(
        userColumns.includes('password_hash'),
        'Expected users.password_hash to exist for credential persistence',
      );
    } finally {
      await db.end();
    }
  },
);

test(
  'password reset token table includes lifecycle fields',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await mysql.createPool({
      uri: TEST_DATABASE_URL,
      dateStrings: true,
      timezone: 'Z',
      multipleStatements: true,
    });
    try {
      await ensureSchema(db);
      const tokenTable = 'password_reset_tokens';

      assert.ok(
        await hasTable(db, tokenTable),
        `Expected ${tokenTable} table to exist`,
      );

      const tokenColumns = await getColumns(db, tokenTable);
      assert.ok(
        tokenColumns.includes('user_id'),
        'Expected user_id in reset-token table',
      );
      assert.ok(
        tokenColumns.includes('created_at'),
        'Expected created_at in reset-token table',
      );
      const hasTokenColumn =
        tokenColumns.includes('token') ||
        tokenColumns.includes('token_hash') ||
        tokenColumns.includes('token_verifier');
      assert.ok(
        hasTokenColumn,
        'Expected a token/hashed-token column in reset-token table',
      );
      const hasExpiryColumn = tokenColumns.includes('expires_at');
      assert.ok(hasExpiryColumn, 'Expected expires_at in reset-token table');
      const hasUsedColumn =
        tokenColumns.includes('used') ||
        tokenColumns.includes('used_at') ||
        tokenColumns.includes('is_used');
      assert.ok(hasUsedColumn, 'Expected used marker in reset-token table');
    } finally {
      await db.end();
    }
  },
);

test(
  'users table includes activation timestamp and optional activation state',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await mysql.createPool({
      uri: TEST_DATABASE_URL,
      dateStrings: true,
      timezone: 'Z',
      multipleStatements: true,
    });
    try {
      await ensureSchema(db);

      const userColumns = await getColumns(db, 'users');
      assert.ok(
        userColumns.includes('activated_at'),
        'Expected users.activated_at column for account activation state',
      );
    } finally {
      await db.end();
    }
  },
);

test(
  'account activation token table includes hash and lifecycle columns',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await mysql.createPool({
      uri: TEST_DATABASE_URL,
      dateStrings: true,
      timezone: 'Z',
      multipleStatements: true,
    });
    try {
      await ensureSchema(db);
      const activationTokenTable = 'account_activation_tokens';

      assert.ok(
        await hasTable(db, activationTokenTable),
        `Expected ${activationTokenTable} table to exist`,
      );

      const tokenColumns = await getColumns(db, activationTokenTable);
      assert.ok(
        tokenColumns.includes('token_id'),
        'Expected token_id in activation-token table',
      );
      assert.ok(
        tokenColumns.includes('user_id'),
        'Expected user_id in activation-token table',
      );
      assert.ok(
        tokenColumns.includes('token_hash'),
        'Expected token_hash in activation-token table',
      );
      assert.ok(
        tokenColumns.includes('created_at'),
        'Expected created_at in activation-token table',
      );
      assert.ok(
        tokenColumns.includes('expires_at'),
        'Expected expires_at in activation-token table',
      );
      assert.ok(
        tokenColumns.includes('used'),
        'Expected used in activation-token table',
      );
      assert.ok(
        tokenColumns.includes('used_at'),
        'Expected used_at in activation-token table',
      );
      assert.ok(
        tokenColumns.includes('invalidated_at'),
        'Expected invalidated_at in activation-token table',
      );
    } finally {
      await db.end();
    }
  },
);
