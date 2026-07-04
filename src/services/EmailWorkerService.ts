import type { EmailJob } from '../entities/EmailJob';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import { OneSignalEmailDeliveryService } from './OneSignalEmailDeliveryService';

type WorkerLogger = {
  info: (message: string, ...params: unknown[]) => void;
  error: (message: string, ...params: unknown[]) => void;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 60 * 1000, 5 * 60 * 1000];

export class EmailWorkerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repository: EmailJobRepository,
    private readonly deliveryService: OneSignalEmailDeliveryService,
    private readonly logger: WorkerLogger = console,
    private readonly intervalMs = 5000,
    private readonly now: () => Date = () => new Date(),
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.processDueJob().catch((error) => {
        this.logger.error('Email worker loop failed', error);
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processDueJob(): Promise<boolean> {
    if (this.running) {
      return false;
    }
    this.running = true;
    try {
      const job = await this.repository.claimNextDueJob(this.now());
      if (!job) {
        return false;
      }
      await this.sendClaimedJob(job);
      return true;
    } finally {
      this.running = false;
    }
  }

  private async sendClaimedJob(job: EmailJob): Promise<void> {
    const attemptNumber = job.attemptCount + 1;
    const result = await this.deliveryService.send(job);
    const now = this.now();
    if (result.ok) {
      await this.repository.markSent(job.jobId, result.messageId, now);
      this.logger.info('Email job sent', {
        emailJobId: job.jobId,
        emailKind: job.emailKind,
        templateId: job.templateId,
        userId: job.userId,
        recipientEmail: job.recipientEmail,
        attemptNumber,
        oneSignalMessageId: result.messageId,
      });
      return;
    }

    const finalAttempt = attemptNumber >= MAX_ATTEMPTS;
    const nextAttemptAt = finalAttempt
      ? null
      : new Date(now.getTime() + RETRY_DELAYS_MS[attemptNumber]);
    await this.repository.markAttemptFailed(
      job.jobId,
      result.summary,
      now,
      nextAttemptAt,
    );
    this.logger.error('Email job send failed', {
      emailJobId: job.jobId,
      emailKind: job.emailKind,
      templateId: job.templateId,
      userId: job.userId,
      recipientEmail: job.recipientEmail,
      attemptNumber,
      finalAttempt,
      payloadKeys: Object.keys(job.payload).sort(),
      errorSummary: result.summary,
    });
  }
}
