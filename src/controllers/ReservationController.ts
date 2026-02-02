import type { Express, Request, Response } from 'express';
import { ReservationService } from '../services/ReservationService';
import { requireAuth } from './AuthMiddleware';

export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  register(app: Express): void {
    app.post('/api/claim', requireAuth, async (req: Request, res: Response) => {
      const serviceKey = String(req.body.service_key || '').trim();
      const claimedByLabel = String(req.body.claimed_by_label || '').trim();
      const claimedByTeam = Boolean(req.body.claimed_by_team);
      try {
        const expires = await this.reservationService.claim(
          serviceKey,
          req.session.userId as number,
          new Date(),
          claimedByLabel || null,
          claimedByTeam,
        );
        res.json({ ok: true, expires_at: expires });
      } catch (err) {
        const message = (err as Error).message;
        if (message === 'Service not found') {
          res.status(404).json({ error: message });
          return;
        }
        if (message === 'Service already claimed') {
          res.status(409).json({ error: message });
          return;
        }
        res.status(400).json({ error: message });
      }
    });

    app.post(
      '/api/release',
      requireAuth,
      async (req: Request, res: Response) => {
        const serviceKey = String(req.body.service_key || '').trim();
        try {
          await this.reservationService.release(
            serviceKey,
            req.session.userId as number,
            new Date(),
          );
          res.json({ ok: true });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Active reservation not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Only the owner can release') {
            res.status(403).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.post(
      '/api/extend',
      requireAuth,
      async (req: Request, res: Response) => {
        const serviceKey = String(req.body.service_key || '').trim();
        try {
          const expires = await this.reservationService.extend(
            serviceKey,
            req.session.userId as number,
            new Date(),
          );
          res.json({ ok: true, expires_at: expires });
        } catch (err) {
          const message = (err as Error).message;
          if (message === 'Service not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Active reservation not found') {
            res.status(404).json({ error: message });
            return;
          }
          if (message === 'Only the owner can extend') {
            res.status(403).json({ error: message });
            return;
          }
          res.status(400).json({ error: message });
        }
      },
    );

    app.get('/events', requireAuth, async (req: Request, res: Response) => {
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.flushHeaders();

      let closed = false;
      req.on('close', () => {
        closed = true;
      });

      const pollIntervalMs = 15000;

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        const expiring = await this.reservationService.listExpiring(
          req.session.userId as number,
          new Date(),
        );

        expiring.forEach((row) => {
          res.write('event: expiring\n');
          res.write(
            `data: ${JSON.stringify({
              service_key: row.service_key,
              environment: row.environment_name,
              service_name: row.service_name,
              minutes_left: row.minutes_left,
            })}\n\n`,
          );
        });
      }, pollIntervalMs);
    });
  }
}
