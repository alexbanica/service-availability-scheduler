import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { AccountDeletionRepository } from '../../repositories/AccountDeletionRepository';
import { AccountDeletionService } from '../../services/AccountDeletionService';
import { UserRepository } from '../../repositories/UserRepository';
import { UserService } from '../../services/UserService';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const ALLOW_TRUNCATE = process.env.TEST_DATABASE_ALLOW_TRUNCATE === '1';

const ids = {
  deletingUser: '00000000-0000-4000-8000-000000000001',
  otherUser: '00000000-0000-4000-8000-000000000002',
  controlUser: '00000000-0000-4000-8000-000000000003',
  soleWorkspace: '10000000-0000-4000-8000-000000000001',
  sharedWorkspace: '10000000-0000-4000-8000-000000000002',
  ownedSharedWorkspace: '10000000-0000-4000-8000-000000000003',
  owner: '20000000-0000-4000-8000-000000000001',
  sharedOwner: '20000000-0000-4000-8000-000000000002',
  service: '30000000-0000-4000-8000-000000000001',
  sharedService: '30000000-0000-4000-8000-000000000002',
  environment: '40000000-0000-4000-8000-000000000001',
  sharedEnvironment: '40000000-0000-4000-8000-000000000002',
};

async function ensureSchema(db: mysql.Pool): Promise<void> {
  const schemaDir = path.join(process.cwd(), 'config', 'schema');
  const order = [
    'users.sql',
    'account_activation_tokens.sql',
    'password_reset_tokens.sql',
    'user_roles.sql',
    'workspaces.sql',
    'workspace_users.sql',
    'workspace_invitations.sql',
    'owners.sql',
    'services.sql',
    'environments.sql',
    'service_environments.sql',
    'reservations.sql',
    'email_jobs.sql',
  ];
  const files = (await fs.readdir(schemaDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const file of files) {
    await db.query(await fs.readFile(path.join(schemaDir, file), 'utf8'));
  }
}

async function truncateAll(db: mysql.Pool): Promise<void> {
  const tables = [
    'email_jobs',
    'workspace_invitations',
    'account_activation_tokens',
    'password_reset_tokens',
    'service_environments',
    'reservations',
    'services',
    'owners',
    'environments',
    'workspace_users',
    'workspaces',
    'user_roles',
    'users',
  ];
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      await db.query(`TRUNCATE TABLE ${table}`);
    }
  } finally {
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function createPool(): Promise<mysql.Pool> {
  const db = mysql.createPool({
    uri: TEST_DATABASE_URL,
    dateStrings: true,
    timezone: 'Z',
    multipleStatements: true,
  });
  await ensureSchema(db);
  await truncateAll(db);
  return db;
}

function createService(db: mysql.Pool): AccountDeletionService {
  return new AccountDeletionService(
    new AccountDeletionRepository(db),
    new UserService(new UserRepository(db)),
    db,
  );
}

async function insertUsers(db: mysql.Pool): Promise<void> {
  await db.query(
    `INSERT INTO users (user_id, email, nickname, password_hash, google_subject, activated_at)
     VALUES (?, ?, ?, ?, ?, NOW()), (?, ?, ?, NULL, NULL, NOW()), (?, ?, ?, NULL, NULL, NOW())`,
    [
      ids.deletingUser,
      'Delete.Me@Example.com',
      'Delete Me',
      'password-hash',
      'google-subject',
      ids.otherUser,
      'other@example.com',
      'Other',
      ids.controlUser,
      'control@example.com',
      'Control',
    ],
  );
}

async function scalar(
  db: mysql.Pool,
  sql: string,
  parameters: unknown[] = [],
): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(sql, parameters);
  return Number(rows[0]?.total ?? 0);
}

async function counts(db: mysql.Pool): Promise<Record<string, number>> {
  const tables = [
    'users',
    'user_roles',
    'workspaces',
    'workspace_users',
    'workspace_invitations',
    'owners',
    'services',
    'environments',
    'service_environments',
    'reservations',
    'password_reset_tokens',
    'account_activation_tokens',
    'email_jobs',
  ];
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [
        table,
        await scalar(db, `SELECT COUNT(*) AS total FROM ${table}`),
      ]),
    ),
  );
}

async function snapshotDatabase(
  db: mysql.Pool,
): Promise<Record<string, RowDataPacket[]>> {
  const tableNames = Object.keys(await counts(db));
  return Object.fromEntries(
    await Promise.all(
      tableNames.map(async (table) => {
        const [rows] = await db.query<RowDataPacket[]>(
          `SELECT * FROM ${table}`,
        );
        rows.sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        );
        return [table, rows];
      }),
    ),
  );
}

async function seedCompleteDeletionGraph(db: mysql.Pool): Promise<void> {
  await insertUsers(db);
  await db.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [
    ids.deletingUser,
    'platform_admin',
  ]);
  await db.query(
    `INSERT INTO workspaces (workspace_id, name, admin_user_id)
     VALUES (?, 'Sole owned', ?), (?, 'Shared membership', ?)`,
    [ids.soleWorkspace, ids.deletingUser, ids.sharedWorkspace, ids.otherUser],
  );
  await db.query(
    `INSERT INTO workspace_users (workspace_id, user_id, role)
     VALUES (?, ?, 'admin'), (?, ?, 'admin'), (?, ?, 'member')`,
    [
      ids.soleWorkspace,
      ids.deletingUser,
      ids.sharedWorkspace,
      ids.otherUser,
      ids.sharedWorkspace,
      ids.deletingUser,
    ],
  );
  await db.query(
    `INSERT INTO owners (owner_id, workspace_id, name)
     VALUES (?, ?, ?), (?, ?, ?)`,
    [
      ids.owner,
      ids.soleWorkspace,
      'Owned team',
      ids.sharedOwner,
      ids.sharedWorkspace,
      'Shared team',
    ],
  );
  await db.query(
    `INSERT INTO services (service_id, workspace_id, label, default_minutes, owner_id)
     VALUES (?, ?, 'API', 30, ?), (?, ?, 'Shared API', 30, ?)`,
    [
      ids.service,
      ids.soleWorkspace,
      ids.owner,
      ids.sharedService,
      ids.sharedWorkspace,
      ids.sharedOwner,
    ],
  );
  await db.query(
    `INSERT INTO environments (environment_id, workspace_id, name)
     VALUES (?, ?, ?), (?, ?, ?)`,
    [
      ids.environment,
      ids.soleWorkspace,
      'Production',
      ids.sharedEnvironment,
      ids.sharedWorkspace,
      'Production',
    ],
  );
  await db.query(
    `INSERT INTO service_environments (service_id, environment_id, service_key)
     VALUES (?, ?, 'sole-owned:api:production'),
            (?, ?, 'shared:api:production')`,
    [ids.service, ids.environment, ids.sharedService, ids.sharedEnvironment],
  );
  await db.query(
    `INSERT INTO reservations
       (reservation_id, service_key, environment_name, service_name, user_id,
        claimed_at, expires_at, released_at)
     VALUES
       ('50000000-0000-4000-8000-000000000001', 'sole-owned:api:production',
        'Production', 'API', ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), NULL),
       ('50000000-0000-4000-8000-000000000002', 'shared:api:production',
        'Production', 'Shared API', ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), NULL),
       ('50000000-0000-4000-8000-000000000003', 'sole-owned:api:production',
        'Production', 'API', ?, DATE_SUB(NOW(), INTERVAL 3 HOUR),
        DATE_SUB(NOW(), INTERVAL 2 HOUR), NULL),
       ('50000000-0000-4000-8000-000000000004', 'shared:api:production',
        'Production', 'Shared API', ?, DATE_SUB(NOW(), INTERVAL 2 HOUR),
        DATE_SUB(NOW(), INTERVAL 1 HOUR), NOW())`,
    [ids.otherUser, ids.deletingUser, ids.deletingUser, ids.deletingUser],
  );
  await db.query(
    `INSERT INTO password_reset_tokens
       (token_id, user_id, token_hash, expires_at, used)
     VALUES ('60000000-0000-4000-8000-000000000001', ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 0)`,
    [ids.deletingUser, 'a'.repeat(64)],
  );
  await db.query(
    `INSERT INTO account_activation_tokens
       (token_id, user_id, token_hash, expires_at, used)
     VALUES ('70000000-0000-4000-8000-000000000001', ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 0)`,
    [ids.deletingUser, 'b'.repeat(64)],
  );
  await db.query(
    `INSERT INTO workspace_invitations
       (invitation_id, workspace_id, invited_email, invited_user_id,
        invited_by_user_id, invitation_code_hash, expires_at, status)
     VALUES
       ('80000000-0000-4000-8000-000000000001', ?, 'someone@example.com', NULL, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
       ('80000000-0000-4000-8000-000000000002', ?, 'other@example.com', ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'accepted'),
       ('80000000-0000-4000-8000-000000000003', ?, '  DELETE.ME@example.COM  ', NULL, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY), 'revoked'),
       ('80000000-0000-4000-8000-000000000004', ?, 'control@example.com', ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending'),
       ('80000000-0000-4000-8000-000000000005', ?, 'control@example.com', ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'pending')`,
    [
      ids.sharedWorkspace,
      ids.deletingUser,
      '1'.repeat(64),
      ids.sharedWorkspace,
      ids.deletingUser,
      ids.otherUser,
      '2'.repeat(64),
      ids.sharedWorkspace,
      ids.otherUser,
      '3'.repeat(64),
      ids.sharedWorkspace,
      ids.controlUser,
      ids.otherUser,
      '4'.repeat(64),
      ids.soleWorkspace,
      ids.controlUser,
      ids.otherUser,
      '5'.repeat(64),
    ],
  );
  await db.query(
    `INSERT INTO email_jobs
       (job_id, email_kind, recipient_email, user_id, template_id,
        payload_json, idempotency_key, status)
     VALUES
       ('90000000-0000-4000-8000-000000000001', 'password_reset', 'other@example.com', ?, 'template', '{}', '91000000-0000-4000-8000-000000000001', 'sent'),
       ('90000000-0000-4000-8000-000000000002', 'account_activation', '  delete.me@EXAMPLE.COM ', NULL, 'template', '{}', '91000000-0000-4000-8000-000000000002', 'failed'),
       ('90000000-0000-4000-8000-000000000003', 'workspace_invitation', 'control@example.com', ?, 'template', '{}', '91000000-0000-4000-8000-000000000003', 'pending')`,
    [ids.deletingUser, ids.controlUser],
  );
}

test(
  'owned-workspace conflict preserves the complete real-schema graph without mutation',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createPool();
    try {
      await seedCompleteDeletionGraph(db);
      await db.query(
        'INSERT INTO workspaces (workspace_id, name, admin_user_id) VALUES (?, ?, ?)',
        [ids.ownedSharedWorkspace, 'Owned shared', ids.deletingUser],
      );
      await db.query(
        `INSERT INTO workspace_users (workspace_id, user_id, role)
         VALUES (?, ?, 'admin'), (?, ?, 'member')`,
        [
          ids.ownedSharedWorkspace,
          ids.deletingUser,
          ids.ownedSharedWorkspace,
          ids.otherUser,
        ],
      );
      const before = await snapshotDatabase(db);

      const result = await createService(db).deleteCurrentUser(
        ids.deletingUser,
        ' delete.me@example.COM ',
      );

      assert.deepEqual(result, {
        status: 'owned_workspace_conflict',
        error:
          'Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account.',
      });
      assert.deepEqual(await snapshotDatabase(db), before);
    } finally {
      await truncateAll(db);
      await db.end();
    }
  },
);

test(
  'deletion locks serialize a competing membership insert at the decisive conflict check',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createPool();
    const deletionConnection = await db.getConnection();
    const membershipConnection = await db.getConnection();
    try {
      await insertUsers(db);
      await db.query(
        'INSERT INTO workspaces (workspace_id, name, admin_user_id) VALUES (?, ?, ?)',
        [ids.soleWorkspace, 'Sole owned', ids.deletingUser],
      );
      await db.query(
        `INSERT INTO workspace_users (workspace_id, user_id, role)
         VALUES (?, ?, 'admin')`,
        [ids.soleWorkspace, ids.deletingUser],
      );

      await deletionConnection.beginTransaction();
      const deletionRepository = new AccountDeletionRepository(
        db,
      ).withConnection(deletionConnection);
      assert.equal(
        await deletionRepository.hasOwnedWorkspaceWithOtherMembers(
          ids.deletingUser,
        ),
        false,
      );

      await membershipConnection.query(
        'SET SESSION innodb_lock_wait_timeout = 1',
      );
      await assert.rejects(
        membershipConnection.query(
          `INSERT INTO workspace_users (workspace_id, user_id, role)
           VALUES (?, ?, 'member')`,
          [ids.soleWorkspace, ids.otherUser],
        ),
        (error: unknown) => {
          const mysqlError = error as { code?: string; errno?: number };
          assert.equal(mysqlError.code, 'ER_LOCK_WAIT_TIMEOUT');
          assert.equal(mysqlError.errno, 1205);
          return true;
        },
      );

      await deletionConnection.rollback();
      await membershipConnection.query(
        `INSERT INTO workspace_users (workspace_id, user_id, role)
         VALUES (?, ?, 'member')`,
        [ids.soleWorkspace, ids.otherUser],
      );

      const result = await createService(db).deleteCurrentUser(
        ids.deletingUser,
        'delete.me@example.com',
      );
      assert.deepEqual(result, {
        status: 'owned_workspace_conflict',
        error:
          'Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account.',
      });
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM users WHERE user_id = ?',
          [ids.deletingUser],
        ),
        1,
      );
      assert.equal(
        await scalar(
          db,
          `SELECT COUNT(*) AS total
           FROM workspace_users
           WHERE workspace_id = ? AND user_id = ?`,
          [ids.soleWorkspace, ids.otherUser],
        ),
        1,
      );
    } finally {
      await deletionConnection.rollback();
      deletionConnection.release();
      membershipConnection.release();
      await truncateAll(db);
      await db.end();
    }
  },
);

test(
  'account deletion removes every attributable row and sole-owned workspace while preserving shared data',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createPool();
    try {
      await seedCompleteDeletionGraph(db);

      const result = await createService(db).deleteCurrentUser(
        ids.deletingUser,
        '  DELETE.ME@example.com ',
      );
      assert.deepEqual(result, { status: 'deleted' });

      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM users WHERE user_id = ?',
          [ids.deletingUser],
        ),
        0,
      );
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM workspaces WHERE workspace_id = ?',
          [ids.soleWorkspace],
        ),
        0,
      );
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM workspaces WHERE workspace_id = ?',
          [ids.sharedWorkspace],
        ),
        1,
      );
      for (const table of ['owners', 'services', 'environments']) {
        assert.equal(
          await scalar(
            db,
            `SELECT COUNT(*) AS total FROM ${table} WHERE workspace_id = ?`,
            [ids.soleWorkspace],
          ),
          0,
        );
      }
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM service_environments WHERE service_id = ?',
          [ids.sharedService],
        ),
        1,
      );
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM workspace_users WHERE user_id = ?',
          [ids.deletingUser],
        ),
        0,
      );
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM reservations WHERE user_id = ? OR service_key = ?',
          [ids.deletingUser, 'sole-owned:api:production'],
        ),
        0,
        'active workspace reservation and all user reservation history must be removed',
      );
      for (const table of [
        'user_roles',
        'password_reset_tokens',
        'account_activation_tokens',
      ]) {
        assert.equal(
          await scalar(
            db,
            `SELECT COUNT(*) AS total FROM ${table} WHERE user_id = ?`,
            [ids.deletingUser],
          ),
          0,
        );
      }
      assert.equal(
        await scalar(db, 'SELECT COUNT(*) AS total FROM workspace_invitations'),
        1,
      );
      assert.equal(
        await scalar(db, 'SELECT COUNT(*) AS total FROM email_jobs'),
        1,
      );
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM services WHERE workspace_id = ?',
          [ids.sharedWorkspace],
        ),
        1,
      );
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM users WHERE user_id IN (?, ?)',
          [ids.otherUser, ids.controlUser],
        ),
        2,
      );
    } finally {
      await truncateAll(db);
      await db.end();
    }
  },
);

test(
  'a forced user-delete failure rolls back earlier account and workspace mutations',
  { skip: !TEST_DATABASE_URL || !ALLOW_TRUNCATE },
  async () => {
    const db = await createPool();
    try {
      await seedCompleteDeletionGraph(db);
      await db.query(
        `CREATE TABLE account_deletion_rollback_guard (
           user_id CHAR(36) PRIMARY KEY,
           CONSTRAINT fk_account_deletion_rollback_guard_user
             FOREIGN KEY (user_id) REFERENCES users(user_id)
         ) ENGINE=InnoDB`,
      );
      await db.query(
        'INSERT INTO account_deletion_rollback_guard (user_id) VALUES (?)',
        [ids.deletingUser],
      );
      const before = await snapshotDatabase(db);

      await assert.rejects(
        createService(db).deleteCurrentUser(
          ids.deletingUser,
          'delete.me@example.com',
        ),
      );

      assert.deepEqual(await snapshotDatabase(db), before);
      assert.equal(
        await scalar(
          db,
          'SELECT COUNT(*) AS total FROM users WHERE user_id = ?',
          [ids.deletingUser],
        ),
        1,
      );
    } finally {
      await db.query('DROP TABLE IF EXISTS account_deletion_rollback_guard');
      await truncateAll(db);
      await db.end();
    }
  },
);
