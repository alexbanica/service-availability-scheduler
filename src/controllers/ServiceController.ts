import type { Express, Request, Response } from 'express';
import { ReservationService } from '../services/ReservationService';
import { requireAuth } from './AuthMiddleware';

export class ServiceController {
  constructor(private readonly reservationService: ReservationService) {}

  register(app: Express): void {
    app.get(
      '/api/services',
      requireAuth,
      async (req: Request, res: Response) => {
        const list = await this.reservationService.getServiceList(
          req.session.userId as number,
          new Date(),
        );
        res.json({
          expiry_warning_minutes: list.expiryWarningMinutes,
          auto_refresh_minutes: list.autoRefreshMinutes,
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
