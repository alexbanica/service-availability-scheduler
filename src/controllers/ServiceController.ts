import type { Express, Response, Request } from 'express';
import { ReservationService } from '../services/ReservationService';
import { requireActivated, requireAuth } from './AuthMiddleware';

type AuthenticatedRequest = Request & {
  authenticatedUser: {
    userId: string;
    email: string;
    nickname: string;
  };
};

const getAuthenticatedUserId = (req: Request): string | undefined =>
  (req as AuthenticatedRequest).authenticatedUser?.userId;

export class ServiceController {
  constructor(private readonly reservationService: ReservationService) {}

  register(app: Express): void {
    app.get(
      '/api/services',
      requireAuth,
      requireActivated,
      async (req: Request, res: Response) => {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          res.status(401).json({ error: 'Not authenticated' });
          return;
        }

        const list = await this.reservationService.getServiceList(
          userId,
          new Date(),
        );
        res.json({
          expiry_warning_minutes: list.expiryWarningMinutes,
          auto_refresh_seconds: list.autoRefreshSeconds,
          services: list.services.map((svc) => ({
            service_id: svc.serviceId,
            label: svc.label,
            default_minutes: svc.defaultMinutes,
            owner: svc.owner,
            workspace_id: svc.workspaceId,
            workspace_name: svc.workspaceName,
            environments: svc.environments.map((env) => ({
              service_key: env.serviceKey,
              environment_id: env.environmentId,
              environment: env.environment,
              active: env.active,
              claimed_by: env.claimedBy,
              claimed_by_id: env.claimedById,
              claimed_at: env.claimedAt,
              expires_at: env.expiresAt,
              claimed_by_team: env.claimedByTeam,
            })),
          })),
        });
      },
    );
  }
}
