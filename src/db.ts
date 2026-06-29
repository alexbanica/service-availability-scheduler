import fs from 'fs/promises';
import path from 'path';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

interface DbConfig {
  uri: string;
  dateStrings: boolean;
  timezone: string;
  multipleStatements: boolean;
}

function getConnectionConfig(): DbConfig {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return {
    uri: url,
    dateStrings: true,
    timezone: 'Z',
    multipleStatements: true,
  };
}

export function createDbPool(): Pool {
  const db = mysql.createPool(getConnectionConfig());
  return db;
}

export async function initDb(runMigrationsOnStartup = true): Promise<Pool> {
  const db = createDbPool();
  await db.query('SELECT 1');
  await ensureSchemaAndSeed(db);
  if (runMigrationsOnStartup) {
    await runPendingMigrations(db);
  }
  return db;
}

const SCHEMA_DIR = path.join(process.cwd(), 'config', 'schema');
const SEED_DIR = path.join(process.cwd(), 'config', 'seed');
const MIGRATIONS_DIR = path.join(process.cwd(), 'config', 'migrations');
const MIGRATIONS_TABLE_NAME = 'schema_migrations';

async function ensureSchemaAndSeed(db: Pool): Promise<void> {
  await ensureMigrationsTable(db);

  const schemaFiles = await listSqlFiles(SCHEMA_DIR);
  if (!schemaFiles.length) {
    return;
  }

  const tableNames = schemaFiles.map((file) => file.tableName);
  const existingTables = await fetchExistingTables(db, tableNames);

  for (const schemaFile of schemaFiles) {
    if (existingTables.has(schemaFile.tableName)) {
      continue;
    }
    await runSqlFile(db, schemaFile.path);

    const seedPath = path.join(SEED_DIR, `${schemaFile.tableName}.sql`);
    if (await fileExists(seedPath)) {
      await runSqlFile(db, seedPath);
    }
  }
}

export async function ensureMigrationsTable(db: Pool): Promise<void> {
  await runSqlText(
    db,
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (
       migration_id VARCHAR(255) PRIMARY KEY,
       applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       file_name VARCHAR(255) NOT NULL
     ) ENGINE=InnoDB;`,
  );
}

export async function runPendingMigrations(db: Pool): Promise<void> {
  await ensureMigrationsTable(db);
  const migrationFiles = await listMigrationFiles(MIGRATIONS_DIR);

  for (const file of migrationFiles) {
    const migrationId = path.basename(file.path, '.sql');

    const recorded = await hasMigrationRecord(db, migrationId);
    if (recorded) {
      continue;
    }

    const sql = (await fs.readFile(file.path, 'utf8')).trim();
    if (sql) {
      await db.query(sql);
    }
    await markMigrationApplied(db, migrationId, file.name);
  }
}

async function hasMigrationRecord(
  db: Pool,
  migrationId: string,
): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT 1 AS exists_flag
     FROM ${MIGRATIONS_TABLE_NAME}
     WHERE migration_id = ?
     LIMIT 1`,
    [migrationId],
  );
  return rows.length > 0;
}

async function markMigrationApplied(
  db: Pool,
  migrationId: string,
  fileName: string,
): Promise<void> {
  await db.query(
    `INSERT INTO ${MIGRATIONS_TABLE_NAME}
       (migration_id, file_name)
     VALUES
       (?, ?)`,
    [migrationId, fileName],
  );
}

async function listSqlFiles(
  dirPath: string,
): Promise<Array<{ tableName: string; path: string }>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const order = new Map<string, number>([
      ['users', 10],
      ['password_reset_tokens', 15],
      ['user_roles', 20],
      ['workspaces', 30],
      ['workspace_users', 40],
      ['workspace_invitations', 50],
      ['owners', 60],
      ['services', 70],
      ['environments', 80],
      ['service_environments', 90],
      ['reservations', 100],
    ]);
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => {
        const tableName = path.basename(entry.name, '.sql');
        return { tableName, path: path.join(dirPath, entry.name) };
      })
      .sort((a, b) => {
        const aOrder = order.get(a.tableName) ?? 100;
        const bOrder = order.get(b.tableName) ?? 100;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return a.tableName.localeCompare(b.tableName);
      });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function listMigrationFiles(
  dirPath: string,
): Promise<Array<{ name: string; path: string }>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function fetchExistingTables(
  db: Pool,
  tableNames: string[],
): Promise<Set<string>> {
  if (!tableNames.length) {
    return new Set();
  }
  const placeholders = tableNames.map(() => '?').join(',');
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    tableNames,
  );
  return new Set(rows.map((row) => row.TABLE_NAME as string));
}

async function runSqlFile(db: Pool, filePath: string): Promise<void> {
  const sql = (await fs.readFile(filePath, 'utf8')).trim();
  if (!sql) {
    return;
  }
  await runSqlText(db, sql);
}

async function runSqlText(db: Pool, sql: string): Promise<void> {
  await db.query(sql);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
