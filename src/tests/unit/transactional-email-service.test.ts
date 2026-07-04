import assert from 'node:assert/strict';
import test from 'node:test';

import { EmailTemplateService } from '../../services/EmailTemplateService';
import { TransactionalEmailService } from '../../services/TransactionalEmailService';

type LoggerMessage = {
  message: string;
  params: Array<unknown>;
};

class LoggerStub {
  public infoMessages: LoggerMessage[] = [];
  public errorMessages: LoggerMessage[] = [];

  info(message: string, ...params: Array<unknown>): void {
    this.infoMessages.push({ message, params });
  }

  error(message: string, ...params: Array<unknown>): void {
    this.errorMessages.push({ message, params });
  }
}

class EmailJobRepositoryStub {
  public createCount = 0;

  async create(): Promise<unknown> {
    this.createCount += 1;
    return { created: true };
  }
}

function createDisabledService(
  repository: EmailJobRepositoryStub,
  logger: LoggerStub,
): TransactionalEmailService {
  const templateService = new EmailTemplateService({
    enabled: false,
    appId: '',
    restApiKey: '',
    publicAppBaseUrl: 'http://localhost:3000',
    templateIds: {
      passwordReset: '',
      accountActivation: '',
      workspaceInvitation: '',
    },
  });

  return new TransactionalEmailService(
    repository as never,
    templateService,
    3600,
    86400,
    logger as never,
  );
}

function assertLoggedRequest(
  logger: LoggerStub,
  index: number,
  expected: {
    emailKind: string;
    recipientEmail: string;
    userId: string | null;
    payloadKey: string;
    payloadValue: string;
  },
): void {
  const message = logger.infoMessages[index];
  assert.ok(message, `expected log message ${index}`);
  assert.equal(typeof message.message, 'string');
  assert.equal(
    message.message.includes('OneSignal email delivery disabled'),
    true,
  );
  const payload = message.params[0] as Record<string, unknown>;
  assert.equal(payload.emailKind, expected.emailKind);
  assert.equal(payload.recipientEmail, expected.recipientEmail);
  assert.equal(payload.userId, expected.userId);
  assert.equal(
    (payload.payloadKeys as Array<string>).includes(expected.payloadKey),
    true,
  );
  assert.equal(
    (payload.payload as Record<string, string>)[expected.payloadKey],
    expected.payloadValue,
  );
}

test('development-disabled TransactionalEmailService logs all email requests and does not create email jobs', async () => {
  const logger = new LoggerStub();
  const repository = new EmailJobRepositoryStub();
  const service = createDisabledService(repository, logger);

  await service.queuePasswordResetEmail({
    token: 'reset-token',
    recipientEmail: 'user@example.com',
    userId: 'user-1',
  });
  await service.queueAccountActivationEmail({
    token: 'activation-token',
    recipientEmail: 'new@example.com',
    userId: 'user-2',
    nickname: 'New User',
  });
  await service.queueWorkspaceInvitationEmail({
    code: 'invite-code',
    recipientEmail: 'invitee@example.com',
    userId: null,
    workspaceName: 'Operations',
  });

  assert.equal(repository.createCount, 0);
  assert.equal(logger.infoMessages.length, 3);
  assertLoggedRequest(logger, 0, {
    emailKind: 'password_reset',
    recipientEmail: 'user@example.com',
    userId: 'user-1',
    payloadKey: 'reset_url',
    payloadValue: 'http://localhost:3000/reset-password/reset-token',
  });
  assertLoggedRequest(logger, 1, {
    emailKind: 'account_activation',
    recipientEmail: 'new@example.com',
    userId: 'user-2',
    payloadKey: 'activation_url',
    payloadValue: 'http://localhost:3000/activate-account/activation-token',
  });
  assertLoggedRequest(logger, 2, {
    emailKind: 'workspace_invitation',
    recipientEmail: 'invitee@example.com',
    userId: null,
    payloadKey: 'invitation_url',
    payloadValue: 'http://localhost:3000/workspace-invitations/invite-code',
  });
  assert.equal(logger.errorMessages.length, 0);
});
