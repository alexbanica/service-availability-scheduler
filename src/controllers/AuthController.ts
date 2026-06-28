import type { Express, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { JwtAuthService } from '../services/JwtAuthService';
import { assignJwtAuthService, requireAuth } from './AuthMiddleware';

type AuthenticatedRequest = Request & {
  authenticatedUser: {
    userId: string;
    email: string;
    nickname: string;
  };
};

export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtAuthService: JwtAuthService,
  ) {}

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

      const token = await this.jwtAuthService.issueToken({
        userId: user.userId,
        email: user.email,
        nickname: user.nickname,
      });

      res.json({
        ok: true,
        user,
        token,
        token_type: 'Bearer',
        expires_in_seconds: this.jwtAuthService.getExpiresInSeconds(),
      });
    });

    app.post(
      '/api/logout',
      requireAuth,
      async (_req: Request, res: Response) => {
        res.json({ ok: true });
      },
    );

    app.get('/api/me', requireAuth, async (_req: Request, res: Response) => {
      const reqWithUser = _req as AuthenticatedRequest;
      if (!reqWithUser.authenticatedUser) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      res.json({
        id: reqWithUser.authenticatedUser.userId,
        email: reqWithUser.authenticatedUser.email,
        nickname: reqWithUser.authenticatedUser.nickname,
      });
    });

    app.post(
      '/api/renew',
      requireAuth,
      async (_req: Request, res: Response) => {
        const reqWithUser = _req as AuthenticatedRequest;
        if (!reqWithUser.authenticatedUser) {
          res.status(401).json({ error: 'Not authenticated' });
          return;
        }

        const token = await this.jwtAuthService.issueToken({
          userId: reqWithUser.authenticatedUser.userId,
          email: reqWithUser.authenticatedUser.email,
          nickname: reqWithUser.authenticatedUser.nickname,
        });

        res.json({
          ok: true,
          user: reqWithUser.authenticatedUser,
          token,
          token_type: 'Bearer',
          expires_in_seconds: this.jwtAuthService.getExpiresInSeconds(),
        });
      },
    );

    assignJwtAuthService(app, this.jwtAuthService);
  }
}
