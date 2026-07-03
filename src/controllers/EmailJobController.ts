import type { Express, Request, Response } from 'express';
import type { EmailKind } from '../entities/EmailJob';
import { EmailJobRepository } from '../repositories/EmailJobRepository';
import { UserRoleRepository } from '../repositories/UserRoleRepository';
import { requireActivated, requireAuth } from './AuthMiddleware';

type AuthenticatedRequest = Request & {
  authenticatedUser?: {
    userId: string;
    email: string;
    nickname: string;
    activated: boolean;
  };
};

type RetryLogger = {
  info: (message: string, ...params: unknown[]) => void;
};

const EMAIL_KINDS: EmailKind[] = [
  'password_reset',
  'account_activation',
  'workspace_invitation',
];

export class EmailJobController {
  constructor(
    private readonly emailJobRepository: EmailJobRepository,
    private readonly userRoleRepository: UserRoleRepository,
    private readonly logger: RetryLogger = console,
  ) {}

  register(app: Express): void {
    app.post(
      '/api/email-jobs/failed/retry',
      requireAuth,
      requireActivated,
      async (req: Request, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        const operatorUserId = authReq.authenticatedUser?.userId;
        if (!operatorUserId) {
          res.status(401).json({ error: 'Not authenticated' });
          return;
        }

        const platformAdmin =
          await this.userRoleRepository.isPlatformAdmin(operatorUserId);
        if (!platformAdmin) {
          res.status(403).json({ error: 'Not authorized' });
          return;
        }

        const emailKind = this.parseEmailKind(req.body?.email_kind);
        if (req.body?.email_kind !== undefined && !emailKind) {
          res.status(400).json({ error: 'Invalid email_kind' });
          return;
        }

        const jobIds = this.parseJobIds(req.body?.job_ids);
        if (jobIds === null) {
          res.status(400).json({ error: 'Invalid job_ids' });
          return;
        }

        const retried = await this.emailJobRepository.retryFailedJobs({
          emailKind: emailKind ?? undefined,
          jobIds: jobIds.length ? jobIds : undefined,
        });
        this.logger.info('Failed email jobs retriggered', {
          operatorUserId,
          emailKind: emailKind ?? null,
          jobIdsCount: jobIds.length,
          retried,
        });
        res.json({ ok: true, retried });
      },
    );
  }

  private parseEmailKind(value: unknown): EmailKind | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return EMAIL_KINDS.includes(normalized as EmailKind)
      ? (normalized as EmailKind)
      : null;
  }

  private parseJobIds(value: unknown): string[] | null {
    if (value === undefined) {
      return [];
    }
    if (!Array.isArray(value)) {
      return null;
    }
    const jobIds = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    return jobIds.length === value.length ? jobIds : null;
  }
}
