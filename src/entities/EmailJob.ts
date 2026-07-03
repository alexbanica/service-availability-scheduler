export type EmailKind =
  | 'password_reset'
  | 'account_activation'
  | 'workspace_invitation';

export type EmailJobStatus =
  | 'pending'
  | 'sending'
  | 'retryable'
  | 'sent'
  | 'failed';

export type EmailJob = {
  jobId: string;
  emailKind: EmailKind;
  recipientEmail: string;
  userId: string | null;
  templateId: string;
  payload: Record<string, string>;
  idempotencyKey: string;
  status: EmailJobStatus;
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  oneSignalMessageId: string | null;
  lastErrorSummary: string | null;
  createdAt: Date;
  updatedAt: Date | null;
};
