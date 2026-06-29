import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type MigrationNameExpectation = {
  label: string;
  required: boolean;
};

function listMigrationFiles(): string[] {
  const migrationDir = path.join(process.cwd(), 'config', 'migrations');
  if (!fs.existsSync(migrationDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();
}

test('migrations directory contains table-scoped migration SQL files', () => {
  const files = listMigrationFiles();
  assert.ok(
    files.length > 0,
    'Expected checked-in table-scoped migration files in config/migrations',
  );

  const namePattern =
    /^\d+_[a-z0-9-]+_(users|password_reset_tokens|account_activation_tokens|workspace_users)\.sql$/;
  for (const file of files) {
    assert.ok(
      namePattern.test(file),
      `Expected table-scoped migration filename: ${file}`,
    );
  }

  const sorted = [...files].sort();
  assert.deepEqual(
    files,
    sorted,
    'Migration discovery must be deterministic order',
  );

  const expectations: MigrationNameExpectation[] = [
    { label: 'users', required: true },
    { label: 'password_reset_tokens', required: true },
    { label: 'account_activation_tokens', required: true },
    { label: 'workspace_users', required: true },
  ];

  for (const expectation of expectations) {
    const matching = files.filter((file) =>
      file.endsWith(`_${expectation.label}.sql`),
    );
    assert.equal(matching.length > 0, expectation.required);
  }
});

test('npm migration job script is declared', () => {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  const scripts = packageContent.scripts ?? {};
  const hasMigrationScript =
    typeof scripts.migrate === 'string' ||
    Object.keys(scripts).some((name) => name.includes('migrate'));
  assert.equal(
    hasMigrationScript,
    true,
    'Expected an npm migration job script (migrate) or equivalent key',
  );
});
