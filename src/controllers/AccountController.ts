import type { Express, Request, Response } from 'express';
import type { AccountDeletionResult } from '../services/AccountDeletionService';
import { requireAuth } from './AuthMiddleware';

type AuthenticatedRequest = Request & {
  authenticatedUser?: {
    userId: string;
  };
};

interface AccountDeletionServiceLike {
  deleteCurrentUser: (
    userId: string,
    confirmationEmail: string,
  ) => Promise<AccountDeletionResult>;
}

const OWNED_WORKSPACE_CONFLICT_MESSAGE =
  'Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account.';

export class AccountController {
  constructor(
    private readonly accountDeletionService: AccountDeletionServiceLike,
  ) {}

  register(app: Express): void {
    app.delete(
      '/api/users/me',
      requireAuth,
      async (req: Request, res: Response) => {
        const authenticatedRequest = req as AuthenticatedRequest;
        const currentUser = authenticatedRequest.authenticatedUser;
        if (!currentUser?.userId) {
          res.status(401).json({ error: 'Not authenticated' });
          return;
        }

        const body = req.body;
        if (
          body === null ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.getPrototypeOf(body) !== Object.prototype ||
          Object.keys(body).length !== 1 ||
          !Object.prototype.hasOwnProperty.call(body, 'confirmation_email') ||
          typeof (body as { confirmation_email?: unknown })
            .confirmation_email !== 'string'
        ) {
          res.status(400).json({ error: 'Invalid request' });
          return;
        }

        try {
          const result = await this.accountDeletionService.deleteCurrentUser(
            currentUser.userId,
            (body as { confirmation_email: string }).confirmation_email,
          );
          const status = result.status;

          if (status === 'deleted') {
            res.status(204).end();
            return;
          }
          if (status === 'confirmation_mismatch') {
            res.status(400).json({ error: 'Invalid confirmation email' });
            return;
          }
          if (status === 'user_not_found') {
            res.status(401).json({ error: 'Not authenticated' });
            return;
          }
          if (status === 'owned_workspace_conflict') {
            res.status(409).json({ error: OWNED_WORKSPACE_CONFLICT_MESSAGE });
            return;
          }

          res.status(500).json({ error: 'Account deletion failed' });
        } catch {
          res.status(500).json({ error: 'Account deletion failed' });
        }
      },
    );
  }
}
