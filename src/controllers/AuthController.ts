import type { Express, Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { UserService } from '../services/UserService';
import { JwtAuthService } from '../services/JwtAuthService';
import { PasswordService } from '../services/PasswordService';
import { CaptchaService } from '../services/CaptchaService';
import { PasswordResetTokenService } from '../services/PasswordResetTokenService';
import { AccountActivationTokenService } from '../services/AccountActivationTokenService';
import { assignJwtAuthService, requireAuth } from './AuthMiddleware';

type Logger = {
  info: (message: string, ...params: Array<unknown>) => void;
};

type AuthenticatedRequest = Request & {
  authenticatedUser: {
    userId: string;
    email: string;
    nickname: string;
    activated: boolean;
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
    private readonly accountActivationTokenService?: AccountActivationTokenService,
    activationLogger?: Logger,
    private readonly db?: Pool,
  ) {
    this.activationLogger = activationLogger ?? this.resetLogger;
  }

  private readonly activationLogger: Logger;

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
        activated: user.activated,
      });

      res.json({
        ok: true,
        user: {
          id: user.userId,
          userId: user.userId,
          email: user.email,
          nickname: user.nickname,
          activated: user.activated,
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
      const confirmPassword = String(
        req.body.confirm_password ||
          req.body.confirmPassword ||
          req.body.password_confirmation ||
          '',
      );

      if (!token) {
        res.status(400).json({ error: 'Reset token required' });
        return;
      }

      if (!password) {
        res.status(400).json({ error: 'Password required' });
        return;
      }

      if (!confirmPassword) {
        res.status(400).json({ error: 'Password confirmation required' });
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Password confirmation does not match' });
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

    app.post('/api/register/captcha', async (_req: Request, res: Response) => {
      const challenge = await this.captchaService.createChallenge();
      res.json({
        ok: true,
        challenge_id: challenge.challengeId,
        challenge_prompt: challenge.prompt,
      });
    });

    app.post('/api/register', async (req: Request, res: Response) => {
      const email = String(req.body.email || '')
        .trim()
        .toLowerCase();
      const nickname = String(req.body.nickname || '').trim();
      const password = String(req.body.password || '');
      const confirmPassword = String(req.body.confirm_password || '');
      const challengeId = String(
        req.body.challenge_id || req.body.challengeId || '',
      );
      const challengeAnswer = String(
        req.body.challenge_answer || req.body.challengeAnswer || '',
      );

      if (!email) {
        res.status(400).json({ error: 'Email required' });
        return;
      }

      if (!nickname) {
        res.status(400).json({ error: 'Nickname required' });
        return;
      }

      if (!password.trim()) {
        res.status(400).json({ error: 'Password required' });
        return;
      }

      if (!this.passwordService.validatePassword(password)) {
        res.status(400).json({ error: 'Password is too short' });
        return;
      }

      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Password confirmation does not match' });
        return;
      }

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

      const existingUser = await this.userService.findByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const accountActivationTokenService = this.accountActivationTokenService;
      if (!accountActivationTokenService) {
        res
          .status(500)
          .json({ error: 'Account activation token service unavailable' });
        return;
      }

      const passwordHash = await this.passwordService.hashPassword(password);
      if (!this.db) {
        const user = await this.userService.createUser(
          email,
          nickname,
          passwordHash,
          false,
        );
        const activationToken =
          await accountActivationTokenService.createTokenForUser(user.userId);
        this.activationLogger.info(
          `Activation requested for ${user.email}, use this TODO link: /activate-account/${activationToken} - TODO replace with email delivery`,
        );
        res.json({ ok: true });
        return;
      }

      const connection = await this.db.getConnection();
      try {
        await connection.beginTransaction();
        const user = await this.userService.createUser(
          email,
          nickname,
          passwordHash,
          false,
          connection,
        );
        const activationToken =
          await accountActivationTokenService.createTokenForUser(
            user.userId,
            connection,
          );
        await connection.commit();
        this.activationLogger.info(
          `Activation requested for ${user.email}, use this TODO link: /activate-account/${activationToken} - TODO replace with email delivery`,
        );
        res.json({ ok: true });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    });

    app.post(
      '/api/account-activation/validate',
      async (req: Request, res: Response) => {
        const accountActivationTokenService =
          this.accountActivationTokenService;
        if (!accountActivationTokenService) {
          res
            .status(500)
            .json({ error: 'Account activation token service unavailable' });
          return;
        }

        const token = String(req.body.token || req.body.activation_token || '');
        if (!token) {
          res.status(400).json({ error: 'Invalid activation token' });
          return;
        }

        const valid = await accountActivationTokenService.validateToken(token);
        if (!valid) {
          res.status(400).json({ error: 'Invalid activation token' });
          return;
        }

        res.json({ ok: true });
      },
    );

    app.post('/api/account-activation', async (req: Request, res: Response) => {
      const accountActivationTokenService = this.accountActivationTokenService;
      if (!accountActivationTokenService) {
        res
          .status(500)
          .json({ error: 'Account activation token service unavailable' });
        return;
      }

      const token = String(req.body.token || req.body.activation_token || '');
      if (!token) {
        res.status(400).json({ error: 'Invalid activation token' });
        return;
      }

      const valid =
        typeof accountActivationTokenService.activateAccount === 'function'
          ? await accountActivationTokenService.activateAccount(
              token,
              this.userService,
            )
          : await accountActivationTokenService.consumeToken(token);
      if (!valid) {
        res.status(400).json({ error: 'Invalid activation token' });
        return;
      }

      if (typeof accountActivationTokenService.activateAccount !== 'function') {
        await this.userService.setUserActivated(valid.userId, true);
        await this.userService.grantPlatformAdminRole(valid.userId);
      }

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
        activated: reqWithUser.authenticatedUser.activated,
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
          activated: reqWithUser.authenticatedUser.activated,
        });

        res.json({
          ok: true,
          user: {
            id: reqWithUser.authenticatedUser.userId,
            userId: reqWithUser.authenticatedUser.userId,
            email: reqWithUser.authenticatedUser.email,
            nickname: reqWithUser.authenticatedUser.nickname,
            activated: reqWithUser.authenticatedUser.activated,
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
