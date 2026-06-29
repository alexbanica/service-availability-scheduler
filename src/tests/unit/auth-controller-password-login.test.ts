import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { AuthController } from '../../controllers/AuthController';
import { User } from '../../entities/User';
import type { PasswordResetTokenValidation } from '../../services/PasswordResetTokenService';

class PasswordServiceStub {
  constructor(private readonly acceptedPassword: string) {}

  validatePassword(password: string): boolean {
    return typeof password === 'string' && password.length >= 8;
  }

  async hashPassword(password: string): Promise<string> {
    return `hash-${password}`;
  }

  async verifyPassword(
    password: string,
    _passwordHash: string,
  ): Promise<boolean> {
    void _passwordHash;
    return password === this.acceptedPassword;
  }
}

type LoggerMessage = {
  message: string;
  params: Array<unknown>;
};

class CaptchaServiceStub {
  constructor(
    private readonly createPayload: () => {
      challengeId: string;
      prompt: string;
    },
    private readonly validateResult: boolean,
  ) {}

  async createChallenge(): Promise<{ challengeId: string; prompt: string }> {
    return this.createPayload();
  }

  async validateChallenge(_id: string, _answer: string): Promise<boolean> {
    void _id;
    void _answer;
    return this.validateResult;
  }
}

class PasswordResetTokenServiceStub {
  public createCount = 0;
  public validateCalls = 0;
  public consumeCount = 0;
  public updatedToken = '';
  public createResult: string;
  public validateMap: Record<string, PasswordResetTokenValidation | null> = {};
  public consumeMap: Record<string, PasswordResetTokenValidation | null> = {};

  constructor(
    options: {
      createResult?: string;
      validateMap?: Record<string, PasswordResetTokenValidation | null>;
      consumeMap?: Record<string, PasswordResetTokenValidation | null>;
    } = {},
  ) {
    this.createResult = options.createResult ?? 'token-abc';
    this.validateMap = options.validateMap ?? {};
    this.consumeMap = options.consumeMap ?? {};
  }

  async createTokenForUser(userId: string): Promise<string> {
    this.createCount += 1;
    this.updatedToken = userId;
    return this.createResult;
  }

  async validateToken(
    token: string,
  ): Promise<PasswordResetTokenValidation | null> {
    this.validateCalls += 1;
    return this.validateMap[token] ?? null;
  }

  async consumeToken(
    token: string,
  ): Promise<PasswordResetTokenValidation | null> {
    this.consumeCount += 1;
    return this.consumeMap[token] ?? null;
  }
}

class ResetLoggerStub {
  public messages: LoggerMessage[] = [];
  info(message: string, ...params: Array<unknown>): void {
    this.messages.push({ message, params });
  }
}

type HttpResponse = {
  statusCode: number;
  body: unknown;
};

type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | void;

type JwtUserIdentity = {
  userId: string;
  email: string;
  nickname: string;
};

class FakeJwtAuthService {
  private issueCount = 0;

  constructor(private readonly jwtExpiresInSeconds: number) {}

  getExpiresInSeconds(): number {
    return this.jwtExpiresInSeconds;
  }

  async issueToken(identity: JwtUserIdentity): Promise<string> {
    return `token-${identity.userId}-${++this.issueCount}`;
  }
}

type PasswordAwareUser = User & {
  passwordHash?: string | null;
};

class FakeUserService {
  public updatedPasswordHash: string | null = null;

  constructor(private readonly user: PasswordAwareUser | null) {}

  async findByEmail(email: string): Promise<PasswordAwareUser | null> {
    if (!this.user || email !== this.user.email) {
      return null;
    }
    return this.user;
  }

  async findByEmailWithPasswordHash(
    email: string,
  ): Promise<PasswordAwareUser | null> {
    if (!this.user || email !== this.user.email) {
      return null;
    }

    return this.user;
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    this.updatedPasswordHash = `${userId}:${passwordHash}`;
  }
}

function createResponse(): {
  response: Response;
  getResponse: () => HttpResponse;
} {
  let statusCode = 200;
  let body: unknown = null;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  return {
    response,
    getResponse: () => ({ statusCode, body }),
  };
}

function getRouteHandlers(
  app: express.Express,
  method: 'get' | 'post' | 'patch',
  path: string,
): RouteHandler[] {
  const routeLayer = (
    app as unknown as { _router: { stack: unknown[] } }
  )._router.stack.find((layer) => {
    const route = (
      layer as { route?: { path?: string; methods?: Record<string, boolean> } }
    ).route;
    return route?.path === path && route.methods?.[method] === true;
  }) as
    | {
        route: {
          stack: Array<{ handle: RouteHandler }>;
        };
      }
    | undefined;
  assert.ok(routeLayer, `Route ${method.toUpperCase()} ${path} not found`);
  return routeLayer.route.stack.map((entry) => entry.handle);
}

function createRequest(options: {
  path: string;
  method: 'POST';
  body?: Record<string, unknown>;
  app: express.Express;
}): Request {
  return {
    method: options.method,
    path: options.path,
    body: options.body ?? {},
    app: options.app,
    header: () => '',
  } as unknown as Request;
}

async function runHandlers(
  handlers: RouteHandler[],
  req: Request,
): Promise<HttpResponse> {
  const { response, getResponse } = createResponse();
  let index = 0;

  const next: NextFunction = async (error?: unknown) => {
    if (error) {
      throw error;
    }
    index += 1;
    if (index < handlers.length) {
      await handlers[index](req, response, next);
    }
  };

  await handlers[0](req, response, next);
  return getResponse();
}

function createLoginController(
  user: PasswordAwareUser | null,
  acceptedPassword = 'correct-password',
  passwordResetTokenService?: PasswordResetTokenServiceStub,
  captchaService?: CaptchaServiceStub,
  resetLogger?: ResetLoggerStub,
): AuthController {
  const userService = new FakeUserService(user);
  const fakePasswordService = new PasswordServiceStub(acceptedPassword);
  return new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    new FakeJwtAuthService(3600),
    fakePasswordService as unknown,
    captchaService as unknown,
    passwordResetTokenService as unknown,
    resetLogger as unknown,
  );
}

function createUser(email: string, hasHash: boolean): PasswordAwareUser {
  const user = new User('user-1', email, 'Alice') as PasswordAwareUser;
  user.passwordHash = hasHash ? 'stored-hash' : null;
  return user;
}

test('POST /api/login rejects missing email', async () => {
  const app = express();
  app.use(express.json());
  const controller = createLoginController(
    createUser('alice@example.com', true),
  );
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const response = await runHandlers(
    login,
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: { password: 'correct-password' },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal((response.body as { error?: string }).error, 'Email required');
});

test('POST /api/login rejects missing password', async () => {
  const app = express();
  app.use(express.json());
  const controller = createLoginController(
    createUser('alice@example.com', true),
  );
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const response = await runHandlers(
    login,
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: { email: 'alice@example.com' },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(
    (response.body as { error?: string }).error,
    'Password required',
  );
});

test('POST /api/login rejects whitespace-only password', async () => {
  const app = express();
  app.use(express.json());
  const controller = createLoginController(
    createUser('alice@example.com', true),
  );
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const response = await runHandlers(
    login,
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: {
        email: 'alice@example.com',
        password: '   ',
      },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(
    (response.body as { error?: string }).error,
    'Password required',
  );
});

test('POST /api/login rejects unknown email with 403', async () => {
  const app = express();
  app.use(express.json());
  const controller = createLoginController(null);
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const response = await runHandlers(
    login,
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: {
        email: 'missing@example.com',
        password: 'correct-password',
      },
    }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(typeof (response.body as { error?: string }).error, 'string');
  assert.equal((response.body as { token?: unknown }).token, undefined);
});

test('POST /api/login rejects users without stored password hash', async () => {
  const app = express();
  app.use(express.json());
  const controller = createLoginController(
    createUser('alice@example.com', false),
  );
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const response = await runHandlers(
    login,
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: {
        email: 'alice@example.com',
        password: 'correct-password',
      },
    }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(typeof (response.body as { error?: string }).error, 'string');
});

test('POST /api/login rejects wrong password with 403', async () => {
  const app = express();
  app.use(express.json());
  const controller = createLoginController(
    createUser('alice@example.com', true),
    'correct-password',
  );
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const response = await runHandlers(
    login,
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: {
        email: 'alice@example.com',
        password: 'wrong-password',
      },
    }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(typeof (response.body as { error?: string }).error, 'string');
});

test('POST /api/login normalizes email and returns token payload on success', async () => {
  const app = express();
  app.use(express.json());
  const controller = createLoginController(
    createUser('alice@example.com', true),
    'correct-password',
  );
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const response = await runHandlers(
    login,
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: {
        email: ' ALICE@EXAMPLE.COM ',
        password: 'correct-password',
      },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
  assert.equal((response.body as { token_type?: string }).token_type, 'Bearer');
  assert.equal((response.body as { token?: string }).token, 'token-user-1-1');
  assert.equal(
    (response.body as { expires_in_seconds?: number }).expires_in_seconds,
    3600,
  );
  const user = (response.body as { user?: Record<string, unknown> }).user;
  assert.equal(user?.id, 'user-1');
  assert.equal(user?.userId, 'user-1');
  assert.equal(user && 'password' in user, false);
  assert.equal(user && 'passwordHash' in user, false);
});

test('POST /api/password-reset/captcha returns challenge data without answer', async () => {
  const app = express();
  app.use(express.json());
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'challenge-id', prompt: 'What is 2 + 3?' }),
    true,
  );
  const controller = createLoginController(
    createUser('alice@example.com', true),
    'correct-password',
    undefined,
    captchaService,
  );
  controller.register(app);

  const route = getRouteHandlers(app, 'post', '/api/password-reset/captcha');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/captcha',
    }),
  );

  assert.equal(response.statusCode, 200);
  const body = response.body as {
    ok?: boolean;
    challenge_id?: string;
    challenge_prompt?: string;
    answer?: unknown;
  };
  assert.equal(body.ok, true);
  assert.equal(body.challenge_id, 'challenge-id');
  assert.equal(body.challenge_prompt, 'What is 2 + 3?');
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'answer'), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(body, 'challenge_answer'),
    false,
  );
});

test('POST /api/password-reset/request returns invalid-captcha for wrong answer', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new PasswordResetTokenServiceStub();
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'challenge-id', prompt: 'ignored' }),
    false,
  );
  const logger = new ResetLoggerStub();
  const controller = createLoginController(
    createUser('alice@example.com', true),
    'correct-password',
    tokenService,
    captchaService,
    logger,
  );
  controller.register(app);

  const requestRoute = getRouteHandlers(
    app,
    'post',
    '/api/password-reset/request',
  );
  const response = await runHandlers(
    requestRoute,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/request',
      body: {
        email: 'alice@example.com',
        challenge_id: 'challenge-id',
        challenge_answer: 'wrong',
      },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal((response.body as { error?: string }).error, 'Invalid captcha');
  assert.equal(tokenService.createCount, 0);
  assert.equal(logger.messages.length, 0);
});

test('POST /api/password-reset/request succeeds for known and unknown users without leaking reset URL', async () => {
  const app = express();
  app.use(express.json());

  const knownTokenService = new PasswordResetTokenServiceStub({
    createResult: 'known-token',
  });
  const knownCaptchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'challenge-id', prompt: 'ignored' }),
    true,
  );
  const knownLogger = new ResetLoggerStub();
  const knownController = createLoginController(
    createUser('alice@example.com', true),
    'correct-password',
    knownTokenService,
    knownCaptchaService,
    knownLogger,
  );
  knownController.register(app);

  const requestRoute = getRouteHandlers(
    app,
    'post',
    '/api/password-reset/request',
  );

  const knownResponse = await runHandlers(
    requestRoute,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/request',
      body: {
        email: 'alice@example.com',
        challenge_id: 'challenge-id',
        challenge_answer: 'any',
      },
    }),
  );

  assert.equal(knownResponse.statusCode, 200);
  assert.equal((knownResponse.body as { ok?: boolean }).ok, true);
  const knownResetBody = knownResponse.body as Record<string, unknown>;
  assert.equal(
    Object.prototype.hasOwnProperty.call(knownResetBody, 'token'),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(knownResetBody, 'reset_url'),
    false,
  );
  assert.equal(knownTokenService.createCount, 1);
  assert.equal(knownTokenService.updatedToken, 'user-1');
  assert.equal(
    knownLogger.messages[0]?.message.includes('/reset-password/known-token'),
    true,
  );

  const appUnknown = express();
  appUnknown.use(express.json());
  const unknownTokenService = new PasswordResetTokenServiceStub({
    createResult: 'should-not-be-used',
  });
  const unknownCaptchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'challenge-id', prompt: 'ignored' }),
    true,
  );
  const unknownLogger = new ResetLoggerStub();
  const unknownController = createLoginController(
    null,
    'correct-password',
    unknownTokenService,
    unknownCaptchaService,
    unknownLogger,
  );
  unknownController.register(appUnknown);
  const unknownResponse = await runHandlers(
    getRouteHandlers(appUnknown, 'post', '/api/password-reset/request'),
    createRequest({
      app: appUnknown,
      method: 'POST',
      path: '/api/password-reset/request',
      body: {
        email: 'missing@example.com',
        challenge_id: 'challenge-id',
        challenge_answer: 'any',
      },
    }),
  );

  assert.equal(unknownResponse.statusCode, 200);
  assert.equal((unknownResponse.body as { ok?: boolean }).ok, true);
  assert.equal(unknownTokenService.createCount, 0);
  assert.equal(unknownLogger.messages.length, 0);
});

test('POST /api/password-reset/validate returns correct outcomes for token states', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new PasswordResetTokenServiceStub({
    validateMap: {
      validToken: { tokenId: 'token-1', userId: 'user-1' },
      expiredToken: null,
      usedToken: null,
      unknownToken: null,
    },
  });
  const controller = createLoginController(
    createUser('alice@example.com', true),
    'correct-password',
    tokenService,
  );
  controller.register(app);
  const route = getRouteHandlers(app, 'post', '/api/password-reset/validate');

  const missing = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/validate',
      body: {},
    }),
  );
  assert.equal(missing.statusCode, 400);
  assert.equal(
    (missing.body as { error?: string }).error,
    'Invalid reset token',
  );

  const valid = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/validate',
      body: { token: 'validToken' },
    }),
  );
  assert.equal(valid.statusCode, 200);
  assert.equal((valid.body as { ok?: boolean }).ok, true);

  const invalid = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/validate',
      body: { token: 'unknownToken' },
    }),
  );
  assert.equal(invalid.statusCode, 400);
  assert.equal(
    (invalid.body as { error?: string }).error,
    'Invalid reset token',
  );

  const expired = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/validate',
      body: { token: 'expiredToken' },
    }),
  );
  assert.equal(expired.statusCode, 400);
  assert.equal(
    (expired.body as { error?: string }).error,
    'Invalid reset token',
  );

  const used = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset/validate',
      body: { token: 'usedToken' },
    }),
  );
  assert.equal(used.statusCode, 400);
  assert.equal((used.body as { error?: string }).error, 'Invalid reset token');
});

test('POST /api/password-reset rejects short passwords and updates user hash on success', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new PasswordResetTokenServiceStub({
    validateMap: {
      resetToken: { tokenId: 'token-1', userId: 'user-1' },
    },
    consumeMap: {
      resetToken: { tokenId: 'token-1', userId: 'user-1' },
    },
  });
  const user = createUser('alice@example.com', true);
  const userService = new FakeUserService(user);
  const fakePasswordService = new PasswordServiceStub('ignored');
  const logger = new ResetLoggerStub();

  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    new FakeJwtAuthService(3600),
    fakePasswordService as unknown,
    new CaptchaServiceStub(
      () => ({ challengeId: 'challenge-id', prompt: 'ignored' }),
      false,
    ) as unknown,
    tokenService as unknown,
    logger as unknown,
  );
  controller.register(app);

  const route = getRouteHandlers(app, 'post', '/api/password-reset');
  const short = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset',
      body: { token: 'resetToken', password: 'tiny' },
    }),
  );
  assert.equal(short.statusCode, 400);
  assert.equal(
    (short.body as { error?: string }).error,
    'Password is too short',
  );

  const success = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset',
      body: { token: 'resetToken', password: 'longer-password' },
    }),
  );
  assert.equal(success.statusCode, 200);
  assert.equal((success.body as { ok?: boolean }).ok, true);
  const resetBody = success.body as Record<string, unknown>;
  assert.equal(Object.prototype.hasOwnProperty.call(resetBody, 'token'), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(resetBody, 'token_type'),
    false,
  );
  assert.equal(tokenService.consumeCount, 1);
  assert.equal(userService.updatedPasswordHash, 'user-1:hash-longer-password');
});
