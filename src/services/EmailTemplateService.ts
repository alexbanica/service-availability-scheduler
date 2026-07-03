import type { EmailKind } from '../entities/EmailJob';
import type { OneSignalConfig } from './ConfigLoaderService';

export type EmailTemplateMetadata = {
  kind: EmailKind;
  templateId: string;
  requiredPayloadKeys: string[];
};

export type EmailTemplateCatalog = {
  passwordReset: EmailTemplateMetadata;
  accountActivation: EmailTemplateMetadata;
  workspaceInvitation: EmailTemplateMetadata;
};

export class EmailTemplateService {
  constructor(private readonly oneSignalConfig: OneSignalConfig) {}

  catalog(): EmailTemplateCatalog {
    return {
      passwordReset: {
        kind: 'password_reset',
        templateId: this.oneSignalConfig.templateIds.passwordReset,
        requiredPayloadKeys: [
          'reset_url',
          'expires_in_minutes',
          'recipient_email',
        ],
      },
      accountActivation: {
        kind: 'account_activation',
        templateId: this.oneSignalConfig.templateIds.accountActivation,
        requiredPayloadKeys: ['activation_url', 'nickname', 'recipient_email'],
      },
      workspaceInvitation: {
        kind: 'workspace_invitation',
        templateId: this.oneSignalConfig.templateIds.workspaceInvitation,
        requiredPayloadKeys: [
          'invitation_url',
          'workspace_name',
          'expires_in_hours',
          'recipient_email',
        ],
      },
    };
  }

  metadataFor(kind: EmailKind): EmailTemplateMetadata {
    const catalog = this.catalog();
    if (kind === 'password_reset') {
      return catalog.passwordReset;
    }
    if (kind === 'account_activation') {
      return catalog.accountActivation;
    }
    return catalog.workspaceInvitation;
  }

  buildAbsoluteUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.oneSignalConfig.publicAppBaseUrl}${normalizedPath}`;
  }

  buildPasswordResetPayload(
    token: string,
    recipientEmail: string,
    expiresInSeconds: number,
  ): Record<string, string> {
    return {
      reset_url: this.buildAbsoluteUrl(
        `/reset-password/${encodeURIComponent(token)}`,
      ),
      expires_in_minutes: String(Math.ceil(expiresInSeconds / 60)),
      recipient_email: recipientEmail,
    };
  }

  buildAccountActivationPayload(
    token: string,
    recipientEmail: string,
    nickname: string,
  ): Record<string, string> {
    return {
      activation_url: this.buildAbsoluteUrl(
        `/activate-account/${encodeURIComponent(token)}`,
      ),
      nickname,
      recipient_email: recipientEmail,
    };
  }

  buildWorkspaceInvitationPayload(
    code: string,
    recipientEmail: string,
    workspaceName: string,
    expiresInSeconds: number,
  ): Record<string, string> {
    return {
      invitation_url: this.buildAbsoluteUrl(
        `/workspace-invitations/${encodeURIComponent(code)}`,
      ),
      workspace_name: workspaceName,
      expires_in_hours: String(Math.ceil(expiresInSeconds / 3600)),
      recipient_email: recipientEmail,
    };
  }
}
