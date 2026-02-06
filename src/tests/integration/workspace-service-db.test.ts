import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import mysql, { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { WorkspaceService } from '../../services/WorkspaceService';
import { WorkspaceRepository } from '../../repositories/WorkspaceRepository';
import { WorkspaceUserRepository } from '../../repositories/WorkspaceUserRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { WorkspaceInvitationRepository } from '../../repositories/WorkspaceInvitationRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { UserRoleRepository } from '../../repositories/UserRoleRepository';

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

async function truncateAll(db: mysql.Pool): Promise<void> {
  const tables = [
    'workspace_invitations',
    'service_environments',
    'environments',
    'services',
    'workspace_users',
    'workspaces',
    'user_roles',
    'reservations',
    'users',
  ];
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await db.query(`TRUNCATE TABLE ${table}`);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

test(
  'workspace creation persists admin membership and services',
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
      await truncateAll(db);

      const [userResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['admin@example.com', 'Admin'],
      );
      const adminUserId = userResult.insertId;
      await db.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [
        adminUserId,
        'platform_admin',
      ]);

      const workspaceService = new WorkspaceService(
        db,
        new WorkspaceRepository(db),
        new WorkspaceUserRepository(db),
        new ServiceRepository(db),
        new WorkspaceInvitationRepository(db),
        new UserRepository(db),
        new UserRoleRepository(db),
      );

      const workspace = await workspaceService.createWorkspace(
        adminUserId,
        'Alpha',
      );

      const [workspaceUsers] = await db.query<RowDataPacket[]>(
        'SELECT role FROM workspace_users WHERE workspace_id = ? AND user_id = ?',
        [workspace.id, adminUserId],
      );
      assert.equal(workspaceUsers[0].role, 'admin');

      await workspaceService.createService(workspace.id, adminUserId, {
        environmentNames: ['Development'],
        label: 'API',
        defaultMinutes: 15,
      });

      const serviceRepo = new ServiceRepository(db);
      const services = await serviceRepo.listServiceEnvironmentsByUser(
        adminUserId,
      );
      assert.equal(services.length, 1);
      assert.ok(services[0].serviceKey);
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);
