import assert from 'node:assert/strict';
import test from 'node:test';

import type { EmailJob } from '../../entities/EmailJob';
import type { OneSignalConfig } from '../../services/ConfigLoaderService';
import { OneSignalEmailDeliveryService } from '../../services/OneSignalEmailDeliveryService';

const config: OneSignalConfig = {
  enabled: true,
  appId: 'app-id',
  restApiKey: 'rest-key',
  publicAppBaseUrl: 'https://app.example.com',
  templateIds: {
    passwordReset: 'template-reset',
    accountActivation: 'template-activation',
    workspaceInvitation: 'template-invitation',
  },
  emailFromName: 'Scheduler',
  emailFromAddress: 'no-reply@example.com',
  emailReplyToAddress: 'support@example.com',
};

function emailJob(): EmailJob {
  return {
    jobId: 'job-1',
    emailKind: 'password_reset',
    recipientEmail: 'user@example.com',
    userId: 'user-1',
    templateId: 'template-reset',
    payload: {
      reset_url: 'https://app.example.com/reset-password/token',
      expires_in_minutes: '60',
      recipient_email: 'user@example.com',
    },
    idempotencyKey: 'idempotency-1',
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    lastAttemptAt: null,
    oneSignalMessageId: null,
    lastErrorSummary: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
  };
}

test('OneSignal delivery sends configured template email payload', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (
    url: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ id: 'message-1' }), { status: 200 });
  };

  const result = await new OneSignalEmailDeliveryService(
    config,
    fetchImpl as typeof fetch,
  ).send(emailJob());

  assert.deepEqual(result, { ok: true, messageId: 'message-1' });
  assert.equal(calls[0]?.url, 'https://onesignal.com/api/v1/notifications');
  assert.equal(
    (calls[0]?.init.headers as Record<string, string>).Authorization,
    'Basic rest-key',
  );
  const body = JSON.parse(String(calls[0]?.init.body)) as Record<
    string,
    unknown
  >;
  assert.equal(body.app_id, 'app-id');
  assert.deepEqual(body.email_to, ['user@example.com']);
  assert.equal(body.template_id, 'template-reset');
  assert.deepEqual(body.custom_data, emailJob().payload);
  assert.equal(body.include_unsubscribed, true);
  assert.equal(body.idempotency_key, 'idempotency-1');
  assert.equal(body.email_from_name, 'Scheduler');
  assert.equal(body.email_from_address, 'no-reply@example.com');
  assert.equal(body.email_reply_to_address, 'support@example.com');
});

test('OneSignal delivery treats success without message id as failure', async () => {
  const fetchImpl = async (): Promise<Response> =>
    new Response(JSON.stringify({}), { status: 200 });

  const result = await new OneSignalEmailDeliveryService(
    config,
    fetchImpl as typeof fetch,
  ).send(emailJob());

  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.summary, /missing message id/);
});
