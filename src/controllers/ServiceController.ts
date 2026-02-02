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
        const list = await this.reservationService.getServiceList(new Date());
        res.json({
          expiry_warning_minutes: list.expiryWarningMinutes,
          auto_refresh_minutes: list.autoRefreshMinutes,
          services: list.services.map((svc) => ({
            key: svc.key,
            environment_id: svc.environmentId,
            environment: svc.environment,
            id: svc.id,
            label: svc.label,
            default_minutes: svc.defaultMinutes,
            owner: svc.owner,
            active: svc.active,
            claimed_by: svc.claimedBy,
            claimed_by_id: svc.claimedById,
            claimed_at: svc.claimedAt,
            expires_at: svc.expiresAt,
            claimed_by_team: svc.claimedByTeam,
          })),
        });
      },
    );
  }
}
