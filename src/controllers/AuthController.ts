import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { UserService } from '../services/UserService';
import { JwtAuthService } from '../services/JwtAuthService';
import { PasswordService } from '../services/PasswordService';
import { CaptchaService } from '../services/CaptchaService';
import { PasswordResetTokenService } from '../services/PasswordResetTokenService';
import { AccountActivationTokenService } from '../services/AccountActivationTokenService';
import { WorkspaceService } from '../services/WorkspaceService';
import { RateLimiter } from '../helpers/RateLimiter';
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
  private readonly captchaIpRateLimiter = new RateLimiter(60 * 1000, 20);
  private readonly authIpRateLimiter = new RateLimiter(60 * 1000, 30);
  private readonly authAccountRateLimiter = new RateLimiter(15 * 60 * 1000, 10);
  private readonly tokenIpRateLimiter = new RateLimiter(60 * 1000, 30);

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
    private readonly workspaceService?: WorkspaceService,
  ) {
    this.activationLogger = activationLogger ?? this.resetLogger;
  }

  private readonly activationLogger: Logger;

  private getClientIp(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private accountKey(req: Request): string | null {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    return email ? email : null;
  }

  private enforceRateLimit(
    limiter: RateLimiter,
    keyPrefix: string,
    keyFactory: (req: Request) => string | null,
  ): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = keyFactory(req);
      if (!key) {
        next();
        return;
      }

      if (!limiter.allowRequest(`${keyPrefix}:${key}`, Date.now())) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }

      next();
    };
  }

  private ipRateLimit(
    limiter: RateLimiter,
    keyPrefix: string,
  ): (req: Request, res: Response, next: NextFunction) => void {
    return this.enforceRateLimit(limiter, keyPrefix, (req) =>
      this.getClientIp(req),
    );
  }

  private accountRateLimit(
    keyPrefix: string,
  ): (req: Request, res: Response, next: NextFunction) => void {
    return this.enforceRateLimit(
      this.authAccountRateLimiter,
      keyPrefix,
      (req) => this.accountKey(req),
    );
  }

  private async sendAuthenticatedResponse(
    res: Response,
    user: {
      userId: string;
      email: string;
      nickname: string;
      activated: boolean;
    },
  ): Promise<void> {
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
  }

  register(app: Express): void {
    app.post(
      '/api/login',
      this.ipRateLimit(this.authIpRateLimiter, 'login-ip'),
      this.accountRateLimit('login-account'),
      async (req: Request, res: Response) => {
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

        await this.sendAuthenticatedResponse(res, user);
      },
    );

    app.post(
      '/api/password-reset/captcha',
      this.ipRateLimit(this.captchaIpRateLimiter, 'password-reset-captcha-ip'),
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
      this.ipRateLimit(this.authIpRateLimiter, 'password-reset-request-ip'),
      this.accountRateLimit('password-reset-request-account'),
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
      this.ipRateLimit(this.tokenIpRateLimiter, 'password-reset-validate-ip'),
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

    app.post(
      '/api/password-reset',
      this.ipRateLimit(this.tokenIpRateLimiter, 'password-reset-ip'),
      async (req: Request, res: Response) => {
        const passwordResetTokenService = this.passwordResetTokenService;
        if (!passwordResetTokenService) {
          res.status(500).json({ error: 'Password reset service unavailable' });
          return;
        }

        const token = String(req.body.token || req.body.reset_token || '');
        const password = String(
          req.body.password || req.body.new_password || '',
        );
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
          res
            .status(400)
            .json({ error: 'Password confirmation does not match' });
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
      },
    );

    app.post(
      '/api/register/captcha',
      this.ipRateLimit(this.captchaIpRateLimiter, 'register-captcha-ip'),
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
      '/api/register',
      this.ipRateLimit(this.authIpRateLimiter, 'register-ip'),
      this.accountRateLimit('register-account'),
      async (req: Request, res: Response) => {
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
        const invitationCode = String(
          req.body.invitation_code || req.body.invitationCode || '',
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
          res
            .status(400)
            .json({ error: 'Password confirmation does not match' });
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

        const accountActivationTokenService =
          this.accountActivationTokenService;
        if (!accountActivationTokenService) {
          res
            .status(500)
            .json({ error: 'Account activation token service unavailable' });
          return;
        }
        if (invitationCode && !this.db) {
          res.status(500).json({
            error: 'Workspace service unavailable for invitation registration',
          });
          return;
        }
        if (invitationCode && !this.workspaceService) {
          res.status(500).json({
            error: 'Workspace service unavailable for invitation registration',
          });
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
          await this.sendAuthenticatedResponse(res, {
            userId: user.userId,
            email: user.email,
            nickname: user.nickname,
            activated: false,
          });
          return;
        }

        const connection = await this.db.getConnection();
        let createdUser: {
          userId: string;
          email: string;
          nickname: string;
        };
        let activationToken: string;
        try {
          await connection.beginTransaction();
          const user = await this.userService.createUser(
            email,
            nickname,
            passwordHash,
            false,
            connection,
          );
          activationToken =
            await accountActivationTokenService.createTokenForUser(
              user.userId,
              connection,
            );
          if (invitationCode && this.workspaceService) {
            await this.workspaceService.acceptWorkspaceInvitationForRegistration(
              invitationCode,
              user.userId,
              user.email,
              connection,
            );
          }
          createdUser = user;
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          const message = (error as Error).message;
          if (
            message === 'Invalid invitation code' ||
            message === 'Invitation expired' ||
            message === 'Invitation already used' ||
            message === 'Invitation already assigned' ||
            message === 'Invitation email mismatch'
          ) {
            res.status(400).json({ error: message });
            return;
          }
          throw error;
        } finally {
          connection.release();
        }

        this.activationLogger.info(
          `Activation requested for ${createdUser.email}, use this TODO link: /activate-account/${activationToken} - TODO replace with email delivery`,
        );
        await this.sendAuthenticatedResponse(res, {
          userId: createdUser.userId,
          email: createdUser.email,
          nickname: createdUser.nickname,
          activated: false,
        });
      },
    );

    app.post(
      '/api/account-activation/validate',
      this.ipRateLimit(
        this.tokenIpRateLimiter,
        'account-activation-validate-ip',
      ),
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

    app.post(
      '/api/account-activation',
      this.ipRateLimit(this.tokenIpRateLimiter, 'account-activation-ip'),
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

        if (
          typeof accountActivationTokenService.activateAccount !== 'function'
        ) {
          await this.userService.setUserActivated(valid.userId, true);
          await this.userService.grantPlatformAdminRole(valid.userId);
        }

        const activatedUser = await this.userService.findById(valid.userId);
        if (!activatedUser) {
          res.status(500).json({ error: 'Activated user not found' });
          return;
        }

        await this.sendAuthenticatedResponse(res, {
          userId: activatedUser.userId,
          email: activatedUser.email,
          nickname: activatedUser.nickname,
          activated: true,
        });
      },
    );

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
