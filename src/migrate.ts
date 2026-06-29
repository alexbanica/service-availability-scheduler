import { createDbPool, runPendingMigrations } from './db';

async function main(): Promise<void> {
  const db = createDbPool();

  try {
    await runPendingMigrations(db);
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to run migrations', error);
  process.exit(1);
});
