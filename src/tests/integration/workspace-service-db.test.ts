// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
  assert.ok(
    stats.userCount !== undefined || stats.user_count !== undefined,
    'Workspace summary is missing user count',
  );
  assert.ok(
    stats.serviceCount !== undefined || stats.service_count !== undefined,
    'Workspace summary is missing service count',
  );

  const userCount = stats.userCount ?? stats.user_count;
  const serviceCount = stats.serviceCount ?? stats.service_count;
  assert.equal(userCount, expectedUserCount);
  assert.equal(serviceCount, expectedServiceCount);
}

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const ALLOW_TRUNCATE = process.env.TEST_DATABASE_ALLOW_TRUNCATE === '1';

type ColumnInfo = RowDataPacket & {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  COLUMN_KEY: string;
  EXTRA: string;
  IS_NULLABLE: 'YES' | 'NO';
};

type PopupResource = 'users' | 'services' | 'owners' | 'environments';

type PopupResourceRow = { name: string };

function popupRowDisplayName(row: PopupResourceRow): string {
  return row.name;
}

async function tableExists(
  db: mysql.Pool,
  tableName: string,
): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return rows.length > 0;
}

async function loadPopupResourceRows(
  db: mysql.Pool,
  workspaceId: unknown,
  resourceType: PopupResource,
): Promise<Array<RowDataPacket>> {
  if (resourceType === 'users') {
    const [userIdRows] = await db.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('user_id', 'id')`,
    );
    const userIdColumn = userIdRows.some((row) => row.COLUMN_NAME === 'user_id')
      ? 'user_id'
      : 'id';
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.email
       FROM workspace_users wu
       JOIN users u ON u.${userIdColumn} = wu.user_id
       WHERE wu.workspace_id = ?
       ORDER BY u.email`,
      [workspaceId],
    );
    return rows;
  }

  if (resourceType === 'services') {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT label
       FROM services
       WHERE workspace_id = ?
       ORDER BY label`,
      [workspaceId],
    );
    return rows;
  }

  if (resourceType === 'owners') {
    const hasOwners = await tableExists(db, 'owners');
    if (!hasOwners) {
      return [];
    }
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT name
       FROM owners
       WHERE workspace_id = ?
       ORDER BY name`,
      [workspaceId],
    );
    return rows;
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT environment_id, name
     FROM environments
     WHERE workspace_id = ?
     ORDER BY name`,
    [workspaceId],
  );
  return rows;
}

async function countTableRows(
  db: mysql.Pool,
  tableName: string,
  workspaceId: unknown,
): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM ${tableName} WHERE workspace_id = ?`,
    [workspaceId],
  );
  return Number(rows[0]?.total || 0);
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

async function ensureServiceEnvironmentSchema(db: mysql.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS environments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      workspace_id INT NOT NULL,
      environment_id VARCHAR(36) NOT NULL,
      name VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_service_environments_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      UNIQUE KEY uniq_environments_workspace_name (workspace_id, name),
      UNIQUE KEY uniq_environments_workspace_environment_id (workspace_id, environment_id),
      INDEX idx_environments_workspace (workspace_id)
    ) ENGINE=InnoDB;
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS service_environments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      service_id INT NOT NULL,
      environment_id INT NOT NULL,
      service_key VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_service_environments_service
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
      CONSTRAINT fk_service_environments_environment
        FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_service_environment (service_id, environment_id),
      UNIQUE KEY uniq_service_key (service_key),
      INDEX idx_service_environments_service (service_id),
      INDEX idx_service_environments_environment (environment_id)
    ) ENGINE=InnoDB;
  `);
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
      const services =
        await serviceRepo.listServiceEnvironmentsByUser(adminUserId);
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
  'schema initialization creates UUID-focused ids on empty database and no auto-increment legacy ids',
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

      const targetTables = [
        'users',
        'user_roles',
        'workspaces',
        'workspace_users',
        'workspace_invitations',
        'services',
        'environments',
        'service_environments',
        'reservations',
        'owners',
      ];

      const [existingTables] = await db.query<RowDataPacket[]>(
        `SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN (${targetTables.map(() => '?').join(',')})`,
        targetTables,
      );
      assert.equal(
        existingTables.length,
        targetTables.length,
        `Expected tables: ${targetTables.join(', ')}`,
      );

      const [autoIncrementColumns] = await db.query<ColumnInfo[]>(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA, IS_NULLABLE
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN (${targetTables.map(() => '?').join(',')})
           AND EXTRA LIKE '%auto_increment%'`,
        targetTables,
      );
      assert.equal(
        autoIncrementColumns.length,
        0,
        `Legacy AUTO_INCREMENT columns: ${autoIncrementColumns
          .map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`)
          .join(', ')}`,
      );

      const [legacyIdColumns] = await db.query<ColumnInfo[]>(
        `SELECT TABLE_NAME, COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN (${targetTables.map(() => '?').join(',')})
           AND COLUMN_NAME = 'id'`,
        targetTables,
      );
      assert.equal(
        legacyIdColumns.length,
        0,
        `Unexpected numeric legacy id columns: ${legacyIdColumns
          .map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`)
          .join(', ')}`,
      );

      const uuidIdColumns = [
        'user_id',
        'workspace_id',
        'service_id',
        'environment_id',
      ];
      const [idColumns] = await db.query<ColumnInfo[]>(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, EXTRA, IS_NULLABLE
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND COLUMN_NAME IN (${uuidIdColumns.map(() => '?').join(',')})`,
        uuidIdColumns,
      );
      const idColumnNames = new Set(
        idColumns.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`),
      );
      for (const [table, column] of [
        ['users', 'user_id'],
        ['workspaces', 'workspace_id'],
        ['services', 'service_id'],
        ['environments', 'environment_id'],
      ]) {
        const key = `${table}.${column}`;
        assert.ok(
          idColumnNames.has(key),
          `Missing expected uuid identity column ${key}`,
        );
      }

      const invalidDataTypes = idColumns.filter(
        (row) =>
          !['char', 'varchar', 'binary', 'varbinary', 'uuid'].includes(
            row.DATA_TYPE,
          ),
      );
      assert.equal(
        invalidDataTypes.length,
        0,
        `Non-textual identity columns: ${invalidDataTypes
          .map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}:${row.DATA_TYPE}`)
          .join(', ')}`,
      );

      const [serviceKeyRows] = await db.query<ColumnInfo[]>(
        `SELECT IS_NULLABLE, COLUMN_KEY
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'service_environments'
           AND COLUMN_NAME = 'service_key'`,
      );
      assert.equal(serviceKeyRows[0]?.IS_NULLABLE, 'NO');

      const [uniqueServiceKeyRows] = await db.query<RowDataPacket[]>(
        `SELECT INDEX_NAME
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'service_environments'
           AND INDEX_NAME = 'uniq_service_key'`,
      );
      assert.equal(uniqueServiceKeyRows.length, 1);

      const [compatTriggerRows] = await db.query<RowDataPacket[]>(
        `SELECT TRIGGER_NAME
         FROM information_schema.TRIGGERS
         WHERE TRIGGER_SCHEMA = DATABASE()
           AND TRIGGER_NAME = 'service_environments_before_insert_key'`,
      );
      assert.equal(compatTriggerRows.length, 0);
    } finally {
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

      const workspaceSummaries =
        await workspaceService.listWorkspaces(adminUserId);
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

test(
  'workspace overview returns counts for users, services, owners, and environments',
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

      const [memberResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['member@example.com', 'Member'],
      );
      const memberUserId = memberResult.insertId;

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

      const adminWorkspace = await workspaceService.createWorkspace(
        adminUserId,
        'Admin Workspace',
      );
      const memberWorkspace = await workspaceService.createWorkspace(
        adminUserId,
        'Member Workspace',
      );

      await db.query(
        'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?)',
        [memberWorkspace.id, memberUserId, 'member'],
      );

      await workspaceService.createService(adminWorkspace.id, adminUserId, {
        environmentNames: ['Development'],
        label: 'Auth API',
        defaultMinutes: 20,
      });
      await workspaceService.createService(memberWorkspace.id, adminUserId, {
        environmentNames: ['Staging'],
        label: 'Claims',
        defaultMinutes: 10,
      });

      const hasOwnersTable = await tableExists(db, 'owners');
      if (hasOwnersTable) {
        await db.query(
          'INSERT INTO owners (owner_id, workspace_id, name) VALUES (?, ?, ?), (?, ?, ?)',
          [
            randomUUID(),
            adminWorkspace.id,
            'Alpha Owner',
            randomUUID(),
            memberWorkspace.id,
            'Beta Owner',
          ],
        );
      }

      const summaries = await workspaceService.listWorkspaces(adminUserId);
      const adminSummary = summaries.find(
        (workspace) => workspace.id === adminWorkspace.id,
      );
      const memberSummary = summaries.find(
        (workspace) => workspace.id === memberWorkspace.id,
      );
      assert.ok(adminSummary);
      assert.ok(memberSummary);

      const normalizeSummary = (summary: {
        userCount?: number;
        serviceCount?: number;
        user_count?: number;
        service_count?: number;
        ownerCount?: number;
        owner_count?: number;
        environmentCount?: number;
        environment_count?: number;
      }): {
        userCount: number;
        serviceCount: number;
        ownerCount: number;
        environmentCount: number;
      } => ({
        userCount:
          summary.userCount !== undefined
            ? summary.userCount
            : summary.user_count || 0,
        serviceCount:
          summary.serviceCount !== undefined
            ? summary.serviceCount
            : summary.service_count || 0,
        ownerCount:
          summary.ownerCount !== undefined
            ? summary.ownerCount
            : summary.owner_count || 0,
        environmentCount:
          summary.environmentCount !== undefined
            ? summary.environmentCount
            : summary.environment_count || 0,
      });

      assertWorkspaceHasCounts(adminSummary, 1, 1);
      assertWorkspaceHasCounts(memberSummary, 2, 1);

      const adminOwnerCount = hasOwnersTable
        ? await countTableRows(db, 'owners', adminWorkspace.id)
        : 0;
      const adminEnvironmentCount = await countTableRows(
        db,
        'environments',
        adminWorkspace.id,
      );
      const normalizedAdminSummary = normalizeSummary(adminSummary as never);
      assert.equal(normalizedAdminSummary.ownerCount, adminOwnerCount);
      assert.equal(
        normalizedAdminSummary.environmentCount,
        adminEnvironmentCount,
      );

      const memberOwnerCount = hasOwnersTable
        ? await countTableRows(db, 'owners', memberWorkspace.id)
        : 0;
      const memberEnvironmentCount = await countTableRows(
        db,
        'environments',
        memberWorkspace.id,
      );
      const normalizedMemberSummary = normalizeSummary(memberSummary as never);
      assert.equal(normalizedMemberSummary.ownerCount, memberOwnerCount);
      assert.equal(
        normalizedMemberSummary.environmentCount,
        memberEnvironmentCount,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'stat popup data is scoped by workspace and resource type',
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

      const workspaceOne = await workspaceService.createWorkspace(
        adminUserId,
        'Alpha',
      );
      const workspaceTwo = await workspaceService.createWorkspace(
        adminUserId,
        'Beta',
      );

      const [memberResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['member@example.com', 'Member'],
      );
      const memberUserId = memberResult.insertId;

      await db.query(
        'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?), (?, ?, ?)',
        [
          workspaceTwo.id,
          memberUserId,
          'member',
          workspaceOne.id,
          memberUserId,
          'member',
        ],
      );

      await workspaceService.createService(workspaceOne.id, adminUserId, {
        environmentNames: ['Development'],
        label: 'alpha',
        defaultMinutes: 20,
      });
      await workspaceService.createService(workspaceTwo.id, adminUserId, {
        environmentNames: ['Staging'],
        label: 'beta',
        defaultMinutes: 20,
      });

      const hasOwners = await tableExists(db, 'owners');
      if (hasOwners) {
        await db.query(
          'INSERT INTO owners (owner_id, workspace_id, name) VALUES (?, ?, ?), (?, ?, ?)',
          [
            randomUUID(),
            workspaceOne.id,
            'Owner One',
            randomUUID(),
            workspaceTwo.id,
            'Owner Two',
          ],
        );
      }

      const workspaceOneUsers = await loadPopupResourceRows(
        db,
        workspaceOne.id,
        'users',
      );
      const workspaceOneServices = await loadPopupResourceRows(
        db,
        workspaceOne.id,
        'services',
      );
      const workspaceOneEnvs = await loadPopupResourceRows(
        db,
        workspaceOne.id,
        'environments',
      );
      const workspaceOneOwners = await loadPopupResourceRows(
        db,
        workspaceOne.id,
        'owners',
      );

      assert.ok(
        workspaceOneUsers.some((row) => row.email === 'admin@example.com'),
      );
      assert.ok(workspaceOneServices.some((row) => row.label === 'alpha'));
      assert.ok(workspaceOneEnvs.some((row) => row.name === 'Development'));

      if (hasOwners) {
        assert.ok(workspaceOneOwners.some((row) => row.name === 'Owner One'));
      }

      const workspaceTwoUsers = await loadPopupResourceRows(
        db,
        workspaceTwo.id,
        'users',
      );
      const workspaceTwoServices = await loadPopupResourceRows(
        db,
        workspaceTwo.id,
        'services',
      );
      const workspaceTwoEnvs = await loadPopupResourceRows(
        db,
        workspaceTwo.id,
        'environments',
      );

      assert.ok(
        workspaceTwoUsers.some((row) => row.email === 'admin@example.com'),
      );
      assert.ok(workspaceTwoServices.some((row) => row.label === 'beta'));
      assert.ok(workspaceTwoEnvs.some((row) => row.name === 'Staging'));

      for (const row of workspaceTwoServices) {
        assert.ok(row.label !== 'alpha');
      }
      if (hasOwners) {
        const workspaceTwoOwners = await loadPopupResourceRows(
          db,
          workspaceTwo.id,
          'owners',
        );
        assert.ok(workspaceTwoOwners.some((row) => row.name === 'Owner Two'));
      }
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'listWorkspacePopupRows returns typed resource rows for services, owners, environments, and users',
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
        'Popup Workspace',
      );

      const [memberResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['member@example.com', 'Member'],
      );
      const memberUserId = memberResult.insertId;
      await db.query(
        'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?)',
        [workspace.id, memberUserId, 'member'],
      );

      await workspaceService.createService(workspace.id, adminUserId, {
        environmentNames: ['Zeta Env'],
        label: 'Beta Service',
        defaultMinutes: 30,
      });
      await workspaceService.createService(workspace.id, adminUserId, {
        environmentNames: ['Alpha Env'],
        label: 'Alpha Service',
        defaultMinutes: 30,
      });

      const hasOwnersTable = await tableExists(db, 'owners');
      if (hasOwnersTable) {
        await db.query(
          'INSERT INTO owners (owner_id, workspace_id, name) VALUES (?, ?, ?), (?, ?, ?)',
          [
            randomUUID(),
            workspace.id,
            'Beta Owner',
            randomUUID(),
            workspace.id,
            'Alpha Owner',
          ],
        );
      }

      const users = await workspaceService.listWorkspacePopupRows(
        workspace.id,
        adminUserId,
        'users',
      );
      assert.equal(users.length, 2);
      assert.deepEqual(
        users.map((row) => row.name),
        ['admin@example.com', 'member@example.com'],
      );
      assert.ok(users.every((row) => typeof row.name === 'string'));

      const services = await workspaceService.listWorkspacePopupRows(
        workspace.id,
        adminUserId,
        'services',
      );
      assert.equal(services.length, 2);
      assert.deepEqual(services.map(popupRowDisplayName), [
        'Alpha Service',
        'Beta Service',
      ]);

      if (hasOwnersTable) {
        const owners = await workspaceService.listWorkspacePopupRows(
          workspace.id,
          adminUserId,
          'owners',
        );
        assert.equal(owners.length, 2);
        assert.deepEqual(owners.map(popupRowDisplayName), [
          'Alpha Owner',
          'Beta Owner',
        ]);
      }

      const environments = await workspaceService.listWorkspacePopupRows(
        workspace.id,
        adminUserId,
        'environments',
      );
      assert.equal(environments.length, 2);
      assert.deepEqual(environments.map(popupRowDisplayName), [
        'Alpha Env',
        'Zeta Env',
      ]);
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'listWorkspacePopupRows returns popup rows ordered by display name from the database',
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
        'Ordered Popup Workspace',
      );

      const [memberResultOne] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['zeta@example.com', 'Zeta'],
      );
      const [memberResultTwo] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['amy@example.com', 'Amy'],
      );
      await db.query(
        'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?), (?, ?, ?)',
        [
          workspace.id,
          memberResultOne.insertId,
          'member',
          workspace.id,
          memberResultTwo.insertId,
          'member',
        ],
      );

      await workspaceService.createService(workspace.id, adminUserId, {
        environmentNames: ['Workspace'],
        label: 'Zulu Service',
        defaultMinutes: 15,
      });
      await workspaceService.createService(workspace.id, adminUserId, {
        environmentNames: ['Workspace'],
        label: 'Alpha Service',
        defaultMinutes: 15,
      });

      const hasOwners = await tableExists(db, 'owners');
      if (hasOwners) {
        await db.query(
          'INSERT INTO owners (owner_id, workspace_id, name) VALUES (?, ?, ?), (?, ?, ?)',
          [
            randomUUID(),
            workspace.id,
            'Zulu Owner',
            randomUUID(),
            workspace.id,
            'Alpha Owner',
          ],
        );
      }

      await workspaceService.createEnvironment(workspace.id, adminUserId, {
        name: 'Zulu Environment',
      });
      await workspaceService.createEnvironment(workspace.id, adminUserId, {
        name: 'Alpha Environment',
      });

      const users = await workspaceService.listWorkspacePopupRows(
        workspace.id,
        adminUserId,
        'users',
      );
      assert.deepEqual(users.map(popupRowDisplayName), [
        'admin@example.com',
        'amy@example.com',
        'zeta@example.com',
      ]);

      const services = await workspaceService.listWorkspacePopupRows(
        workspace.id,
        adminUserId,
        'services',
      );
      assert.deepEqual(services.map(popupRowDisplayName), [
        'Alpha Service',
        'Zulu Service',
      ]);

      if (hasOwners) {
        const owners = await workspaceService.listWorkspacePopupRows(
          workspace.id,
          adminUserId,
          'owners',
        );
        assert.deepEqual(owners.map(popupRowDisplayName), [
          'Alpha Owner',
          'Zulu Owner',
        ]);
      }

      const environments = await workspaceService.listWorkspacePopupRows(
        workspace.id,
        adminUserId,
        'environments',
      );
      assert.deepEqual(environments.map(popupRowDisplayName), [
        'Alpha Environment',
        'Zulu Environment',
      ]);

      const emptyWorkspace = await workspaceService.createWorkspace(
        adminUserId,
        'Empty Popup Workspace',
      );
      const emptyServices = await workspaceService.listWorkspacePopupRows(
        emptyWorkspace.id,
        adminUserId,
        'services',
      );
      assert.equal(emptyServices.length, 0);

      const emptyEnvironments = await workspaceService.listWorkspacePopupRows(
        emptyWorkspace.id,
        adminUserId,
        'environments',
      );
      assert.equal(emptyEnvironments.length, 0);

      const hasOwnersTable = await tableExists(db, 'owners');
      if (hasOwnersTable) {
        const emptyOwners = await workspaceService.listWorkspacePopupRows(
          emptyWorkspace.id,
          adminUserId,
          'owners',
        );
        assert.equal(emptyOwners.length, 0);
      }
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'listWorkspacePopupRows enforces workspace membership before returning popup rows',
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
        'Popup Workspace',
      );

      const [outsiderResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['outsider@example.com', 'Outsider'],
      );
      const outsiderUserId = outsiderResult.insertId;

      for (const resourceType of [
        'users',
        'services',
        'owners',
        'environments',
      ] as const) {
        await assert.rejects(
          () =>
            workspaceService.listWorkspacePopupRows(
              workspace.id,
              outsiderUserId,
              resourceType,
            ),
          /Not authorized for workspace/,
        );
      }
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'service creation and update require existing workspace environment identifiers only',
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

      const workspaceOne = await workspaceService.createWorkspace(
        adminUserId,
        'Alpha',
      );
      const workspaceTwo = await workspaceService.createWorkspace(
        adminUserId,
        'Beta',
      );

      await workspaceService.createService(workspaceOne.id, adminUserId, {
        environmentNames: ['Dev'],
        label: 'Alpha Service',
        defaultMinutes: 15,
      });
      await workspaceService.createService(workspaceTwo.id, adminUserId, {
        environmentNames: ['QA'],
        label: 'Beta Service',
        defaultMinutes: 15,
      });

      const [workspaceTwoEnvRows] = await db.query<RowDataPacket[]>(
        'SELECT environment_id FROM environments WHERE workspace_id = ?',
        [workspaceTwo.id],
      );
      const workspaceTwoEnvId = workspaceTwoEnvRows[0]?.environment_id;

      await assert.rejects(
        () =>
          (
            workspaceService as unknown as {
              createService: (
                workspaceId: unknown,
                userId: unknown,
                input: {
                  label: string;
                  defaultMinutes: number;
                  environmentIds: string[];
                },
              ) => Promise<unknown>;
            }
          ).createService(workspaceOne.id, adminUserId, {
            label: 'Cross Workspace',
            defaultMinutes: 15,
            environmentIds: [workspaceTwoEnvId],
          } as never),
        /workspace|not found|not in workspace|environment/i,
      );

      await assert.rejects(
        () =>
          (
            workspaceService as unknown as {
              createService: (
                workspaceId: unknown,
                userId: unknown,
                input: {
                  label: string;
                  defaultMinutes: number;
                  environmentIds: string[];
                },
              ) => Promise<unknown>;
            }
          ).createService(workspaceOne.id, adminUserId, {
            label: 'Unknown Env',
            defaultMinutes: 15,
            environmentIds: [randomUUID()],
          } as never),
        /environment|not found|does not exist/i,
      );

      const [targetService] = await db.query<RowDataPacket[]>(
        'SELECT service_id FROM services WHERE workspace_id = ? ORDER BY label LIMIT 1',
        [workspaceOne.id],
      );
      const serviceId = targetService[0]?.service_id;

      await assert.rejects(
        () =>
          (
            workspaceService as unknown as {
              updateService: (
                workspaceId: unknown,
                userId: unknown,
                input: {
                  serviceId: string;
                  label: string;
                  defaultMinutes: number;
                  environmentIds: string[];
                },
              ) => Promise<unknown>;
            }
          ).updateService(workspaceOne.id, adminUserId, {
            serviceId,
            label: 'Cross Update',
            defaultMinutes: 20,
            environmentIds: [workspaceTwoEnvId],
          } as never),
        /workspace|not found|not in workspace|environment/i,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'updateService requires workspace admin access in database workflow',
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

      const [memberResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['member@example.com', 'Member'],
      );
      const memberUserId = memberResult.insertId;

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

      await db.query(
        'INSERT INTO workspace_users (workspace_id, user_id, role) VALUES (?, ?, ?)',
        [workspace.id, memberUserId, 'member'],
      );

      const created = await workspaceService.createService(
        workspace.id,
        adminUserId,
        {
          environmentNames: ['Dev'],
          label: 'API',
          defaultMinutes: 15,
        },
      );

      await assert.rejects(
        () =>
          workspaceService.updateService(workspace.id, memberUserId, {
            serviceId: created.serviceId,
            label: 'API Updated',
            defaultMinutes: 20,
            environmentNames: ['Dev'],
          }),
        /Not authorized for workspace/,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'updateService requires nonblank label in database workflow',
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
      const created = await workspaceService.createService(
        workspace.id,
        adminUserId,
        {
          environmentNames: ['Dev'],
          label: 'API',
          defaultMinutes: 15,
        },
      );

      await assert.rejects(
        () =>
          workspaceService.updateService(workspace.id, adminUserId, {
            serviceId: created.serviceId,
            label: '   ',
            defaultMinutes: 15,
            environmentNames: ['Dev'],
          }),
        /Service name required/,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'updateService requires at least one environment in database workflow',
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
      const created = await workspaceService.createService(
        workspace.id,
        adminUserId,
        {
          environmentNames: ['Dev'],
          label: 'API',
          defaultMinutes: 15,
        },
      );

      await assert.rejects(
        () =>
          workspaceService.updateService(workspace.id, adminUserId, {
            serviceId: created.serviceId,
            label: 'API',
            defaultMinutes: 15,
            environmentNames: [],
          } as never),
        /At least one environment is required/,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'updateService requires positive default minutes in database workflow',
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
      const created = await workspaceService.createService(
        workspace.id,
        adminUserId,
        {
          environmentNames: ['Dev'],
          label: 'API',
          defaultMinutes: 15,
        },
      );

      await assert.rejects(
        () =>
          workspaceService.updateService(workspace.id, adminUserId, {
            serviceId: created.serviceId,
            label: 'API',
            defaultMinutes: 0,
            environmentNames: ['Dev'],
          }),
        /Default minutes must be positive/,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'updateService updates service metadata and replaces environments without changing service_id',
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
      await ensureServiceEnvironmentSchema(db);
      await truncateAll(db);

      const [adminResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['admin@example.com', 'Admin'],
      );
      const adminUserId = adminResult.insertId;
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

      const managedService =
        workspaceService as unknown as WorkspaceScopedIdOps;
      const eastEnv = await managedService.createEnvironment(
        workspace.id,
        adminUserId,
        {
          name: 'Region East',
        },
      );
      const westEnv = await managedService.createEnvironment(
        workspace.id,
        adminUserId,
        {
          name: 'Region West',
        },
      );
      const ownerAlpha = await managedService.createOwner(
        workspace.id,
        adminUserId,
        {
          name: 'Owner Alpha',
        },
      );
      const ownerBeta = await managedService.createOwner(
        workspace.id,
        adminUserId,
        {
          name: 'Owner Beta',
        },
      );
      const northEnv = await managedService.createEnvironment(
        workspace.id,
        adminUserId,
        {
          name: 'Region North',
        },
      );

      const created = await workspaceService.createService(
        workspace.id,
        adminUserId,
        {
          label: 'API',
          ownerId: ownerAlpha.ownerId,
          defaultMinutes: 15,
          environmentIds: [eastEnv.environmentId, westEnv.environmentId],
        },
      );

      const [serviceRows] = await db.query<RowDataPacket[]>(
        'SELECT service_id, label, default_minutes, owner_id FROM services WHERE workspace_id = ? AND service_id = ?',
        [workspace.id, created.serviceId],
      );
      assert.equal(serviceRows.length, 1);
      assert.equal(serviceRows[0].service_id, created.serviceId);
      assert.equal(serviceRows[0].label, 'API');
      assert.equal(serviceRows[0].default_minutes, 15);
      assert.equal(serviceRows[0].owner_id, ownerAlpha.ownerId);

      const [initialAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT e.name, e.environment_id
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ?
         ORDER BY e.name`,
        [created.serviceId],
      );
      assert.deepEqual(initialAssocRows.map((row) => row.name).sort(), [
        'Region East',
        'Region West',
      ]);

      const [existingEnvRows] = await db.query<RowDataPacket[]>(
        'SELECT environment_id FROM environments WHERE workspace_id = ? AND name = ?',
        [workspace.id, 'Region West'],
      );
      const retainedEnvironmentId = existingEnvRows[0].environment_id;

      const updated = await workspaceService.updateService(
        workspace.id,
        adminUserId,
        {
          serviceId: created.serviceId,
          label: 'API (updated)',
          defaultMinutes: 25,
          ownerId: ownerBeta.ownerId,
          environmentIds: [westEnv.environmentId, northEnv.environmentId],
        },
      );
      assert.equal(updated.serviceId, created.serviceId);

      const [updatedServiceRows] = await db.query<RowDataPacket[]>(
        'SELECT service_id, label, default_minutes, owner_id FROM services WHERE workspace_id = ? AND service_id = ?',
        [workspace.id, created.serviceId],
      );
      assert.equal(updatedServiceRows.length, 1);
      assert.equal(updatedServiceRows[0].label, 'API (updated)');
      assert.equal(updatedServiceRows[0].default_minutes, 25);
      assert.equal(updatedServiceRows[0].owner_id, ownerBeta.ownerId);
      assert.equal(updatedServiceRows[0].service_id, created.serviceId);

      const [updatedAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT e.name, e.environment_id
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ?
         ORDER BY e.name`,
        [created.serviceId],
      );
      const updatedEnvironmentNames = updatedAssocRows.map((row) => row.name);
      assert.deepEqual(updatedEnvironmentNames, [
        'Region North',
        'Region West',
      ]);

      const [eastAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ? AND e.name = ?`,
        [created.serviceId, 'Region East'],
      );
      assert.equal(Number(eastAssocRows[0].count), 0);

      const [northAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT environment_id
         FROM service_environments
         WHERE service_id = ? AND environment_id = ?`,
        [created.serviceId, northEnv.environmentId],
      );
      assert.equal(northAssocRows.length, 1);

      const [westAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT e.environment_id
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ? AND e.name = ?`,
        [created.serviceId, 'Region West'],
      );
      assert.equal(westAssocRows.length, 1);
      assert.equal(westAssocRows[0].environment_id, retainedEnvironmentId);

      const serviceCatalog = await new ServiceRepository(
        db,
      ).listServiceCatalogByWorkspace(workspace.id);
      const catalogRows = serviceCatalog.filter(
        (serviceCatalogEntry) =>
          serviceCatalogEntry.serviceId === created.serviceId,
      );
      assert.equal(catalogRows.length, 2);
      assert.deepEqual(
        catalogRows.map((catalogEntry) => catalogEntry.environmentName).sort(),
        ['Region North', 'Region West'],
      );
      assert.equal(
        catalogRows.some(
          (catalogEntry) => catalogEntry.environmentName === 'Region East',
        ),
        false,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

type WorkspaceScopedIdOps = {
  createEnvironment: (
    workspaceId: unknown,
    userId: unknown,
    input: {
      name: string;
    },
  ) => Promise<{ environmentId: string }>;
  createOwner: (
    workspaceId: unknown,
    userId: unknown,
    input: {
      name: string;
    },
  ) => Promise<{ ownerId: string }>;
  createService: (
    workspaceId: unknown,
    userId: unknown,
    input: {
      label: string;
      defaultMinutes: number;
      environmentNames?: string[];
      environmentIds?: string[];
      environment_ids?: string[];
      ownerId?: string | null;
      owner_id?: string | null;
    },
  ) => Promise<{ serviceId: string }>;
  updateService: (
    workspaceId: unknown,
    userId: unknown,
    input: {
      serviceId: string;
      label: string;
      defaultMinutes: number;
      environmentNames?: string[];
      environmentIds?: string[];
      environment_ids?: string[];
      ownerId?: string | null;
      owner_id?: string | null;
    },
  ) => Promise<unknown>;
};

test(
  'service update reuses existing environment names and creates missing names from environmentNames',
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

      const managedService =
        workspaceService as unknown as WorkspaceScopedIdOps;
      const westEnv = await managedService.createEnvironment(
        workspace.id,
        adminUserId,
        {
          name: 'Region West',
        },
      );
      await managedService.createEnvironment(workspace.id, adminUserId, {
        name: 'Region East',
      });

      const created = await workspaceService.createService(
        workspace.id,
        adminUserId,
        {
          label: 'API',
          defaultMinutes: 15,
          environmentNames: ['Region West', 'Region East'],
        },
      );

      const [initialEnvRows] = await db.query<RowDataPacket[]>(
        `SELECT e.name
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ?
         ORDER BY e.name`,
        [created.serviceId],
      );
      assert.deepEqual(initialEnvRows.map((row) => row.name).sort(), [
        'Region East',
        'Region West',
      ]);

      const updated = await workspaceService.updateService(
        workspace.id,
        adminUserId,
        {
          serviceId: created.serviceId,
          label: 'API',
          defaultMinutes: 15,
          environmentNames: ['region west', 'Region South'],
        },
      );
      assert.equal(updated.serviceId, created.serviceId);

      const [updatedEnvRows] = await db.query<RowDataPacket[]>(
        `SELECT e.name, se.environment_id
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ?
         ORDER BY e.name`,
        [created.serviceId],
      );
      assert.deepEqual(updatedEnvRows.map((row) => row.name).sort(), [
        'Region South',
        'Region West',
      ]);

      const [westAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT se.environment_id
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ? AND e.name = 'Region West'`,
        [created.serviceId],
      );
      assert.equal(westAssocRows.length, 1);
      assert.equal(westAssocRows[0].environment_id, westEnv.environmentId);

      const [eastAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT se.service_id
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ? AND e.name = 'Region East'`,
        [created.serviceId],
      );
      assert.equal(eastAssocRows.length, 0);

      const [southEnvRows] = await db.query<RowDataPacket[]>(
        `SELECT environment_id
         FROM environments
         WHERE workspace_id = ? AND name = 'Region South'`,
        [workspace.id],
      );
      assert.equal(southEnvRows.length, 1);
      const [southAssocRows] = await db.query<RowDataPacket[]>(
        `SELECT se.environment_id
         FROM service_environments se
         JOIN environments e ON e.environment_id = se.environment_id
         WHERE se.service_id = ? AND e.name = 'Region South'`,
        [created.serviceId],
      );
      assert.equal(southAssocRows.length, 1);
      assert.equal(
        southAssocRows[0].environment_id,
        southEnvRows[0].environment_id,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'service creation persists generated service_key per service-environment association',
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

      const created = await workspaceService.createService(
        workspace.id,
        adminUserId,
        {
          environmentNames: ['East', 'West'],
          label: 'Auth API',
          defaultMinutes: 15,
        },
      );

      const [serviceRows] = await db.query<RowDataPacket[]>(
        'SELECT id, service_id FROM services WHERE workspace_id = ? AND service_id = ?',
        [workspace.id, created.serviceId],
      );
      assert.equal(serviceRows.length, 1);
      assert.equal(serviceRows[0].service_id, created.serviceId);

      const serviceDbId = serviceRows[0].id;
      const [assocRows] = await db.query<RowDataPacket[]>(
        `SELECT e.environment_id, se.service_key
         FROM service_environments se
         JOIN environments e ON e.id = se.environment_id
         WHERE se.service_id = ?
         ORDER BY e.name`,
        [serviceDbId],
      );
      assert.equal(assocRows.length, 2);
      assert.equal(new Set(assocRows.map((row) => row.service_key)).size, 2);

      for (const row of assocRows) {
        assert.equal(
          row.service_key,
          `${created.serviceId}:${row.environment_id}`,
        );
      }
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'workspace owner and environment creation require admin authorization, reject blanks, and reject duplicates',
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

      const [memberResult] = await db.query<ResultSetHeader>(
        'INSERT INTO users (email, nickname) VALUES (?, ?)',
        ['member@example.com', 'Member'],
      );
      const memberUserId = memberResult.insertId;

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

      const managedService =
        workspaceService as unknown as WorkspaceScopedIdOps;
      if (
        typeof managedService.createEnvironment !== 'function' ||
        typeof managedService.createOwner !== 'function'
      ) {
        assert.fail(
          'Workspace owner/environment create methods are not implemented yet',
        );
      }

      const workspace = await workspaceService.createWorkspace(
        adminUserId,
        'Workspace',
      );

      await assert.rejects(
        () =>
          managedService.createEnvironment(workspace.id, memberUserId, {
            name: 'Dev',
          }),
        /Not authorized|forbidden|admin/i,
      );
      await assert.rejects(
        () =>
          managedService.createEnvironment(workspace.id, adminUserId, {
            name: '   ',
          }),
        /required|name/i,
      );
      const createdEnv = await managedService.createEnvironment(
        workspace.id,
        adminUserId,
        {
          name: 'Development',
        },
      );
      await assert.rejects(
        () =>
          managedService.createEnvironment(workspace.id, adminUserId, {
            name: 'development',
          }),
        /duplicate|already exists|conflict/i,
      );

      await assert.rejects(
        () =>
          managedService.createOwner(workspace.id, memberUserId, {
            name: 'Team',
          }),
        /Not authorized|forbidden|admin/i,
      );
      await assert.rejects(
        () =>
          managedService.createOwner(workspace.id, adminUserId, { name: '' }),
        /required|name/i,
      );

      const createdOwner = await managedService.createOwner(
        workspace.id,
        adminUserId,
        {
          name: 'Team Owner',
        },
      );
      await assert.rejects(
        () =>
          managedService.createOwner(workspace.id, adminUserId, {
            name: 'team owner',
          }),
        /duplicate|already exists|conflict/i,
      );

      const [envRows] = await db.query<RowDataPacket[]>(
        'SELECT environment_id, name FROM environments WHERE workspace_id = ? ORDER BY name',
        [workspace.id],
      );
      assert.equal(envRows.length, 1);
      assert.equal(envRows[0].environment_id, createdEnv.environmentId);
      assert.equal(envRows[0].name, 'Development');

      const [ownerRows] = await db.query<RowDataPacket[]>(
        'SELECT owner_id, name FROM owners WHERE workspace_id = ? ORDER BY name',
        [workspace.id],
      );
      assert.equal(ownerRows.length, 1);
      assert.equal(ownerRows[0].owner_id, createdOwner.ownerId);
      assert.equal(ownerRows[0].name, 'Team Owner');
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);

test(
  'service create/edit use only in-workspace owner/environment identifiers',
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

      const managedService =
        workspaceService as unknown as WorkspaceScopedIdOps;

      const workspaceOne = await workspaceService.createWorkspace(
        adminUserId,
        'Workspace One',
      );
      const workspaceTwo = await workspaceService.createWorkspace(
        adminUserId,
        'Workspace Two',
      );

      if (
        typeof managedService.createEnvironment !== 'function' ||
        typeof managedService.createOwner !== 'function'
      ) {
        assert.fail(
          'Workspace owner/environment create methods are not implemented yet',
        );
      }

      const envOne = await managedService.createEnvironment(
        workspaceOne.id,
        adminUserId,
        {
          name: 'One',
        },
      );
      const envTwo = await managedService.createEnvironment(
        workspaceTwo.id,
        adminUserId,
        {
          name: 'Two',
        },
      );
      const ownerOne = await managedService.createOwner(
        workspaceOne.id,
        adminUserId,
        {
          name: 'Owner One',
        },
      );
      const ownerTwo = await managedService.createOwner(
        workspaceTwo.id,
        adminUserId,
        {
          name: 'Owner Two',
        },
      );

      const createdService = await managedService.createService(
        workspaceOne.id,
        adminUserId,
        {
          label: 'Service One',
          defaultMinutes: 15,
          environmentIds: [envOne.environmentId],
          ownerId: ownerOne.ownerId,
        },
      );

      await assert.rejects(
        () =>
          managedService.createService(workspaceOne.id, adminUserId, {
            label: 'Cross Env',
            defaultMinutes: 15,
            environmentIds: [envTwo.environmentId],
            ownerId: ownerOne.ownerId,
          }),
        /environment|not in workspace|cross-workspace|not found/i,
      );

      await assert.rejects(
        () =>
          managedService.createService(workspaceOne.id, adminUserId, {
            label: 'Cross Owner',
            defaultMinutes: 15,
            environmentIds: [envOne.environmentId],
            ownerId: ownerTwo.ownerId,
          }),
        /owner|not in workspace|not found/i,
      );

      await assert.rejects(
        () =>
          managedService.updateService(workspaceOne.id, adminUserId, {
            serviceId: createdService.serviceId,
            label: 'Updated',
            defaultMinutes: 20,
            environmentIds: [envTwo.environmentId],
            ownerId: ownerOne.ownerId,
          }),
        /environment|not in workspace|not found/i,
      );

      await assert.rejects(
        () =>
          managedService.updateService(workspaceOne.id, adminUserId, {
            serviceId: createdService.serviceId,
            label: 'Updated',
            defaultMinutes: 20,
            environmentIds: [envOne.environmentId],
            ownerId: ownerTwo.ownerId,
          }),
        /owner|not in workspace|not found/i,
      );

      await assert.rejects(
        () =>
          managedService.createService(workspaceOne.id, adminUserId, {
            label: 'Unknown Env',
            defaultMinutes: 10,
            environmentIds: [randomUUID()],
            ownerId: ownerOne.ownerId,
          }),
        /environment|not in workspace|not found|invalid/i,
      );

      await assert.rejects(
        () =>
          managedService.updateService(workspaceOne.id, adminUserId, {
            serviceId: createdService.serviceId,
            label: 'Updated',
            defaultMinutes: 20,
            environmentIds: [envOne.environmentId, randomUUID()],
            ownerId: ownerOne.ownerId,
          }),
        /environment|not in workspace|not found|invalid/i,
      );

      await workspaceService.deleteService(
        workspaceOne.id,
        adminUserId,
        createdService.serviceId,
      );
    } finally {
      if (ALLOW_TRUNCATE) {
        await truncateAll(db);
      }
      await db.end();
    }
  },
);
