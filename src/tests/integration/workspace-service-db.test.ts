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

type WorkspaceStats = {
  userCount?: number;
  serviceCount?: number;
  user_count?: number;
  service_count?: number;
};

type WorkspaceForSummary = {
  id: number;
  name: string;
  adminUserId: number;
  userCount?: number;
  serviceCount?: number;
  user_count?: number;
  service_count?: number;
};

function assertWorkspaceHasCounts(
  workspace: WorkspaceForSummary,
  expectedUserCount: number,
  expectedServiceCount: number,
): void {
  const stats = workspace as WorkspaceStats;
  const userCount = stats.userCount ?? stats.user_count;
  const serviceCount = stats.serviceCount ?? stats.service_count;
  assert.equal(userCount, expectedUserCount);
  assert.equal(serviceCount, expectedServiceCount);
}

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
      assert.equal(workspace.userCount, 1);
      assert.equal(workspace.serviceCount, 0);

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

test(
  'workspace list shows both administered and member workspaces with summary counts',
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

      const [adminResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['admin@example.com', 'Admin'],
      );
      const adminUserId = adminResult.insertId;

      const [memberOwnerResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['member-owner@example.com', 'Member Owner'],
      );
      const memberOwnerUserId = memberOwnerResult.insertId;

      await db.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [
        adminUserId,
        'platform_admin',
      ]);
      await db.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [
        memberOwnerUserId,
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

      const adminWorkspace = await workspaceService.createWorkspace(
        adminUserId,
        'Alpha',
      );
      const memberWorkspace = await workspaceService.createWorkspace(
        memberOwnerUserId,
        'Beta',
      );

      assertWorkspaceHasCounts(adminWorkspace, 1, 0);

      await db.query(
        'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?)',
        [memberWorkspace.id, adminUserId, 'member'],
      );

      await workspaceService.createService(adminWorkspace.id, adminUserId, {
        environmentNames: ['Development'],
        label: 'Admin API',
        defaultMinutes: 15,
      });

      const workspaceSummaries = await workspaceService.listWorkspaces(adminUserId);
      assert.equal(workspaceSummaries.length, 2);

      const byName = new Map(
        workspaceSummaries.map((workspace) => [workspace.name, workspace]),
      );
      const adminSummary = byName.get('Alpha');
      const memberSummary = byName.get('Beta');
      assert.ok(adminSummary);
      assert.ok(memberSummary);

      assertWorkspaceHasCounts(adminSummary, 1, 1);
      assertWorkspaceHasCounts(memberSummary, 2, 0);
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);
