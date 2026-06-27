import type { Express, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { requireAuth } from './AuthMiddleware';

export class AuthController {
  constructor(private readonly userService: UserService) {}

  register(app: Express): void {
    app.post('/api/login', async (req: Request, res: Response) => {
      const email = String(req.body.email || '')
        .trim()
        .toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'Email required' });
        return;
      }

      const user = await this.userService.findByEmail(email);
      if (!user) {
        res.status(403).json({ error: 'Email not found' });
        return;
      }

      req.session.userId = user.userId;
      req.session.email = user.email;
      req.session.nickname = user.nickname;
      res.json({ ok: true, user });
    });

    app.post('/api/logout', requireAuth, (req: Request, res: Response) => {
      req.session.destroy(() => {
        res.json({ ok: true });
      });
    });

    app.get('/api/me', requireAuth, (req: Request, res: Response) => {
      res.json({
        id: req.session.userId,
        email: req.session.email,
        nickname: req.session.nickname,
      });
    });
  }
}
