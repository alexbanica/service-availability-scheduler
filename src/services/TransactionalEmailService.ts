import type { EmailKind } from '../entities/EmailJob';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import { EmailTemplateService } from './EmailTemplateService';

type EmailLogger = {
  info: (message: string, ...params: unknown[]) => void;
  error: (message: string, ...params: unknown[]) => void;
};

export class TransactionalEmailService {
  constructor(
    private readonly emailJobRepository: EmailJobRepository,
    private readonly templateService: EmailTemplateService,
    private readonly passwordResetExpiresInSeconds: number,
    private readonly workspaceInvitationExpiresInSeconds: number,
    private readonly logger: EmailLogger = console,
  ) {}

  async queuePasswordResetEmail(input: {
    token: string;
    recipientEmail: string;
    userId: string;
  }): Promise<void> {
    await this.createJobSafely('password_reset', input.recipientEmail, {
      userId: input.userId,
      payload: this.templateService.buildPasswordResetPayload(
        input.token,
        input.recipientEmail,
        this.passwordResetExpiresInSeconds,
      ),
    });
  }

  async queueAccountActivationEmail(input: {
    token: string;
    recipientEmail: string;
    userId: string;
    nickname: string;
  }): Promise<void> {
    await this.createJobSafely('account_activation', input.recipientEmail, {
      userId: input.userId,
      payload: this.templateService.buildAccountActivationPayload(
        input.token,
        input.recipientEmail,
        input.nickname,
      ),
    });
  }

  async queueWorkspaceInvitationEmail(input: {
    code: string;
    recipientEmail: string;
    userId: string | null;
    workspaceName: string;
  }): Promise<void> {
    await this.createJobSafely('workspace_invitation', input.recipientEmail, {
      userId: input.userId,
      payload: this.templateService.buildWorkspaceInvitationPayload(
        input.code,
        input.recipientEmail,
        input.workspaceName,
        this.workspaceInvitationExpiresInSeconds,
      ),
    });
  }

  private async createJobSafely(
    emailKind: EmailKind,
    recipientEmail: string,
    input: {
      userId: string | null;
      payload: Record<string, string>;
    },
  ): Promise<void> {
    const metadata = this.templateService.metadataFor(emailKind);
    if (!this.templateService.isOneSignalEnabled()) {
      this.logger.info(
        'OneSignal email delivery disabled because ONESIGNAL_APP_ID is not configured; generated transactional email request',
        {
          emailKind,
          recipientEmail,
          userId: input.userId,
          payloadKeys: Object.keys(input.payload).sort(),
          payload: input.payload,
        },
      );
      return;
    }

    try {
      await this.emailJobRepository.create({
        emailKind,
        recipientEmail,
        userId: input.userId,
        templateId: metadata.templateId,
        payload: input.payload,
      });
    } catch (error) {
      this.logger.error('Failed to queue transactional email job', {
        emailKind,
        templateId: metadata.templateId,
        userId: input.userId,
        recipientEmail,
        payloadKeys: Object.keys(input.payload).sort(),
        errorSummary: (error as Error).message,
      });
    }
  }
}
