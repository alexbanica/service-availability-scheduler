import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { EmailJob, EmailJobStatus, EmailKind } from '../entities/EmailJob';
import {
  AbstractMysqlRepository,
  MysqlConnection,
} from './AbstractMysqlRepository';

type EmailJobRow = RowDataPacket & {
  job_id: string;
  email_kind: EmailKind;
  recipient_email: string;
  user_id: string | null;
  template_id: string;
  payload_json: string;
  idempotency_key: string;
  status: EmailJobStatus;
  attempt_count: number;
  next_attempt_at: Date | null;
  last_attempt_at: Date | null;
  onesignal_message_id: string | null;
  last_error_summary: string | null;
  created_at: Date;
  updated_at: Date | null;
};

export type CreateEmailJobInput = {
  emailKind: EmailKind;
  recipientEmail: string;
  userId: string | null;
  templateId: string;
  payload: Record<string, string>;
};

export type RetryFailedEmailJobsFilter = {
  emailKind?: EmailKind;
  jobIds?: string[];
};

export class EmailJobRepository extends AbstractMysqlRepository {
  constructor(db: MysqlConnection) {
    super(db);
  }

  async create(input: CreateEmailJobInput): Promise<EmailJob> {
    const jobId = randomUUID();
    const idempotencyKey = randomUUID();
    await this.run(
      `INSERT INTO email_jobs
         (job_id, email_kind, recipient_email, user_id, template_id,
          payload_json, idempotency_key, status, attempt_count)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [
        jobId,
        input.emailKind,
        input.recipientEmail,
        input.userId,
        input.templateId,
        JSON.stringify(input.payload),
        idempotencyKey,
      ],
    );
    const job = await this.findById(jobId);
    if (!job) {
      throw new Error('Failed to create email job');
    }
    return job;
  }

  async findById(jobId: string): Promise<EmailJob | null> {
    const row = await this.get<EmailJobRow>(
      `SELECT *
       FROM email_jobs
       WHERE job_id = ?
       LIMIT 1`,
      [jobId],
    );
    return row ? this.mapRow(row) : null;
  }

  async claimNextDueJob(now: Date): Promise<EmailJob | null> {
    const row = await this.get<EmailJobRow>(
      `SELECT *
       FROM email_jobs
       WHERE status IN ('pending', 'retryable')
         AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC, job_id ASC
       LIMIT 1`,
      [now],
    );
    if (!row) {
      return null;
    }

    const result = await this.run(
      `UPDATE email_jobs
       SET status = 'sending',
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = ?
         AND status IN ('pending', 'retryable')`,
      [row.job_id],
    );
    if (result.affectedRows !== 1) {
      return null;
    }
    return this.findById(row.job_id);
  }

  async markSent(jobId: string, messageId: string, now: Date): Promise<void> {
    await this.run(
      `UPDATE email_jobs
       SET status = 'sent',
           attempt_count = attempt_count + 1,
           last_attempt_at = ?,
           onesignal_message_id = ?,
           last_error_summary = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = ?`,
      [now, messageId, jobId],
    );
  }

  async markAttemptFailed(
    jobId: string,
    errorSummary: string,
    now: Date,
    nextAttemptAt: Date | null,
  ): Promise<void> {
    const status: EmailJobStatus = nextAttemptAt ? 'retryable' : 'failed';
    await this.run(
      `UPDATE email_jobs
       SET status = ?,
           attempt_count = attempt_count + 1,
           last_attempt_at = ?,
           next_attempt_at = ?,
           last_error_summary = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = ?`,
      [status, now, nextAttemptAt, errorSummary.slice(0, 1000), jobId],
    );
  }

  async retryFailedJobs(filter: RetryFailedEmailJobsFilter): Promise<number> {
    const clauses = ['status = \'failed\''];
    const params: Array<unknown> = [];
    if (filter.emailKind) {
      clauses.push('email_kind = ?');
      params.push(filter.emailKind);
    }
    if (filter.jobIds?.length) {
      clauses.push(`job_id IN (${filter.jobIds.map(() => '?').join(', ')})`);
      params.push(...filter.jobIds);
    }

    const result = await this.run(
      `UPDATE email_jobs
       SET status = 'pending',
           attempt_count = 0,
           next_attempt_at = NULL,
           last_attempt_at = NULL,
           last_error_summary = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE ${clauses.join(' AND ')}`,
      params,
    );
    return result.affectedRows;
  }

  private mapRow(row: EmailJobRow): EmailJob {
    return {
      jobId: row.job_id,
      emailKind: row.email_kind,
      recipientEmail: row.recipient_email,
      userId: row.user_id,
      templateId: row.template_id,
      payload: JSON.parse(row.payload_json) as Record<string, string>,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      attemptCount: Number(row.attempt_count),
      nextAttemptAt: row.next_attempt_at,
      lastAttemptAt: row.last_attempt_at,
      oneSignalMessageId: row.onesignal_message_id,
      lastErrorSummary: row.last_error_summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
