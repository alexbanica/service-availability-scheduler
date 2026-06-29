import type { Express, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { JwtAuthService } from '../services/JwtAuthService';
import { PasswordService } from '../services/PasswordService';
import { CaptchaService } from '../services/CaptchaService';
import { PasswordResetTokenService } from '../services/PasswordResetTokenService';
import { assignJwtAuthService, requireAuth } from './AuthMiddleware';

type Logger = {
  info: (message: string, ...params: Array<unknown>) => void;
};

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
    private readonly passwordService: PasswordService = new PasswordService(),
    private readonly captchaService: CaptchaService = new CaptchaService(),
    private readonly passwordResetTokenService?: PasswordResetTokenService,
    private readonly resetLogger: Logger = console,
  ) {}

  register(app: Express): void {
    app.post('/api/login', async (req: Request, res: Response) => {
      const email = String(req.body.email || '')
        .trim()
        .toLowerCase();
      const passwordRaw = String(req.body.password || '');
      const password = passwordRaw.trim();

      if (!email) {
        res.status(400).json({ error: 'Email required' });
        return;
      }

      if (!password) {
        res.status(400).json({ error: 'Password required' });
        return;
      }

      const user = await this.userService.findByEmailWithPasswordHash(email);
      if (!user || !user.passwordHash) {
        res.status(403).json({ error: 'Invalid credentials' });
        return;
      }

      const validPassword = await this.passwordService.verifyPassword(
        passwordRaw,
        user.passwordHash,
      );
      if (!validPassword) {
        res.status(403).json({ error: 'Invalid credentials' });
        return;
      }

      const token = await this.jwtAuthService.issueToken({
        userId: user.userId,
        email: user.email,
        nickname: user.nickname,
      });

      res.json({
        ok: true,
        user: {
          id: user.userId,
          userId: user.userId,
          email: user.email,
          nickname: user.nickname,
        },
        token,
        token_type: 'Bearer',
        expires_in_seconds: this.jwtAuthService.getExpiresInSeconds(),
      });
    });

    app.post(
      '/api/password-reset/captcha',
      async (_req: Request, res: Response) => {
        const challenge = await this.captchaService.createChallenge();
        res.json({
          ok: true,
          challenge_id: challenge.challengeId,
          challenge_prompt: challenge.prompt,
        });
      },
    );

    app.post(
      '/api/password-reset/request',
      async (req: Request, res: Response) => {
        const passwordResetTokenService = this.passwordResetTokenService;
        if (!passwordResetTokenService) {
          res.status(500).json({ error: 'Password reset service unavailable' });
          return;
        }

        const email = String(req.body.email || '')
          .trim()
          .toLowerCase();
        if (!email) {
          res.status(400).json({ error: 'Email required' });
          return;
        }

        const challengeId = String(
          req.body.challenge_id || req.body.challengeId || '',
        );
        const challengeAnswer = String(
          req.body.challenge_answer || req.body.challengeAnswer || '',
        );
        if (!challengeId || !challengeAnswer) {
          res.status(400).json({ error: 'Captcha required' });
          return;
        }

        const validCaptcha = await this.captchaService.validateChallenge(
          challengeId,
          challengeAnswer,
        );
        if (!validCaptcha) {
          res.status(400).json({ error: 'Invalid captcha' });
          return;
        }

        const user = await this.userService.findByEmail(email);
        if (!user) {
          res.json({ ok: true });
          return;
        }

        const token = await passwordResetTokenService.createTokenForUser(
          user.userId,
        );

        this.resetLogger.info(
          `Password reset requested for ${user.email}, use this TODO link: /reset-password/${token} - TODO replace with email delivery`,
        );

        res.json({ ok: true });
      },
    );

    app.post(
      '/api/password-reset/validate',
      async (req: Request, res: Response) => {
        const passwordResetTokenService = this.passwordResetTokenService;
        if (!passwordResetTokenService) {
          res.status(500).json({ error: 'Password reset service unavailable' });
          return;
        }

        const token = String(req.body.token || req.body.reset_token || '');
        if (!token) {
          res.status(400).json({ error: 'Invalid reset token' });
          return;
        }

        const valid = await passwordResetTokenService.validateToken(token);
        if (!valid) {
          res.status(400).json({ error: 'Invalid reset token' });
          return;
        }

        res.json({ ok: true });
      },
    );

    app.post('/api/password-reset', async (req: Request, res: Response) => {
      const passwordResetTokenService = this.passwordResetTokenService;
      if (!passwordResetTokenService) {
        res.status(500).json({ error: 'Password reset service unavailable' });
        return;
      }

      const token = String(req.body.token || req.body.reset_token || '');
      const password = String(req.body.password || req.body.new_password || '');

      if (!token) {
        res.status(400).json({ error: 'Reset token required' });
        return;
      }

      if (!password) {
        res.status(400).json({ error: 'Password required' });
        return;
      }

      if (!this.passwordService.validatePassword(password)) {
        res.status(400).json({ error: 'Password is too short' });
        return;
      }

      const validToken = await passwordResetTokenService.validateToken(token);
      if (!validToken) {
        res.status(400).json({ error: 'Invalid reset token' });
        return;
      }

      const passwordHash = await this.passwordService.hashPassword(password);
      await this.userService.updatePasswordHash(
        validToken.userId,
        passwordHash,
      );
      await passwordResetTokenService.consumeToken(token);

      res.json({ ok: true });
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
          user: {
            id: reqWithUser.authenticatedUser.userId,
            userId: reqWithUser.authenticatedUser.userId,
            email: reqWithUser.authenticatedUser.email,
            nickname: reqWithUser.authenticatedUser.nickname,
          },
          token,
          token_type: 'Bearer',
          expires_in_seconds: this.jwtAuthService.getExpiresInSeconds(),
        });
      },
    );

    assignJwtAuthService(app, this.jwtAuthService);
  }
}
