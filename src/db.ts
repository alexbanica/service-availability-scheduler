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

export async function initDb(): Promise<Pool> {
  const db = await mysql.createPool(getConnectionConfig());
  await db.query('SELECT 1');
  await ensureSchemaAndSeed(db);
  return db;
}

const SCHEMA_DIR = path.join(process.cwd(), 'config', 'schema');
const SEED_DIR = path.join(process.cwd(), 'config', 'seed');

async function ensureSchemaAndSeed(db: Pool): Promise<void> {
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

async function listSqlFiles(
  dirPath: string,
): Promise<Array<{ tableName: string; path: string }>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const order = new Map<string, number>([
      ['users', 10],
      ['user_roles', 20],
      ['workspaces', 30],
      ['workspace_users', 40],
      ['workspace_invitations', 50],
      ['services', 60],
      ['reservations', 70],
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
