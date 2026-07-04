import assert from 'node:assert/strict';
import test from 'node:test';

import type { EmailJob } from '../../entities/EmailJob';
import { EmailWorkerService } from '../../services/EmailWorkerService';

function job(attemptCount: number): EmailJob {
  return {
    jobId: `job-${attemptCount}`,
    emailKind: 'account_activation',
    recipientEmail: 'user@example.com',
    userId: 'user-1',
    templateId: 'template-activation',
    payload: { activation_url: 'https://example.com/a', nickname: 'User' },
    idempotencyKey: 'stable-key',
    status: 'sending',
    attemptCount,
    nextAttemptAt: null,
    lastAttemptAt: null,
    oneSignalMessageId: null,
    lastErrorSummary: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
  };
}

test('email worker marks success with OneSignal message id', async () => {
  const claimedJob = job(0);
  const sent: Array<{ jobId: string; messageId: string }> = [];
  const repository = {
    claimNextDueJob: async () => claimedJob,
    markSent: async (jobId: string, messageId: string) => {
      sent.push({ jobId, messageId });
    },
    markAttemptFailed: async () => {
      throw new Error('unexpected failure path');
    },
  };
  const delivery = { send: async () => ({ ok: true, messageId: 'msg-1' }) };

  const processed = await new EmailWorkerService(
    repository as never,
    delivery as never,
    console,
    1000,
    () => new Date('2026-01-01T00:00:00.000Z'),
  ).processDueJob();

  assert.equal(processed, true);
  assert.deepEqual(sent, [{ jobId: 'job-0', messageId: 'msg-1' }]);
});

test('email worker retries failed jobs up to three total attempts', async () => {
  const failures: Array<{ jobId: string; nextAttemptAt: Date | null }> = [];
  const jobs = [job(0), job(2)];
  const repository = {
    claimNextDueJob: async () => jobs.shift() ?? null,
    markSent: async () => {
      throw new Error('unexpected success path');
    },
    markAttemptFailed: async (
      jobId: string,
      _summary: string,
      _now: Date,
      nextAttemptAt: Date | null,
    ) => {
      failures.push({ jobId, nextAttemptAt });
    },
  };
  const delivery = { send: async () => ({ ok: false, summary: 'status 500' }) };
  const worker = new EmailWorkerService(
    repository as never,
    delivery as never,
    console,
    1000,
    () => new Date('2026-01-01T00:00:00.000Z'),
  );

  await worker.processDueJob();
  await worker.processDueJob();

  assert.equal(
    failures[0]?.nextAttemptAt?.toISOString(),
    '2026-01-01T00:01:00.000Z',
  );
  assert.equal(failures[1]?.nextAttemptAt, null);
});
