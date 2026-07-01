import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { AuthController } from '../../controllers/AuthController';
import { User } from '../../entities/User';
import type { PasswordResetTokenValidation } from '../../services/PasswordResetTokenService';

class PasswordServiceStub {
  public hashPasswordCalls = 0;

  constructor(private readonly acceptedPassword: string) {}

  validatePassword(password: string): boolean {
    return typeof password === 'string' && password.length >= 8;
  }

  async hashPassword(password: string): Promise<string> {
    this.hashPasswordCalls += 1;
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
  activated: boolean;
};

class FakeJwtAuthService {
  private issueCount = 0;
  private readonly issued = new Map<string, JwtUserIdentity>();

  constructor(private readonly jwtExpiresInSeconds: number) {}

  getExpiresInSeconds(): number {
    return this.jwtExpiresInSeconds;
  }

  async issueToken(identity: JwtUserIdentity): Promise<string> {
    const token = `token-${identity.userId}-${++this.issueCount}`;
    this.issued.set(token, identity);
    return token;
  }

  async verifyToken(token: string): Promise<JwtUserIdentity> {
    const identity = this.issued.get(token);
    if (!identity) {
      throw new Error('Invalid token');
    }
    return identity;
  }
}

type PasswordAwareUser = User & {
  passwordHash?: string | null;
  activated?: boolean;
};

type ActivationTokenValidation = {
  tokenId: string;
  userId: string;
};

class AccountActivationTokenServiceStub {
  public createCount = 0;
  public validateCalls = 0;
  public consumeCalls = 0;
  public updatedToken = '';
  public createResult: string;
  public validateMap: Record<string, ActivationTokenValidation | null> = {};
  public consumeMap: Record<string, ActivationTokenValidation | null> = {};
  public createConnections: Array<unknown | null> = [];
  public consumeConnectionCalls: Array<unknown | null> = [];
  public validateConnectionCalls: Array<unknown | null> = [];

  constructor(
    options: {
      createResult?: string;
      validateMap?: Record<string, ActivationTokenValidation | null>;
      consumeMap?: Record<string, ActivationTokenValidation | null>;
    } = {},
  ) {
    this.createResult = options.createResult ?? 'activation-token-abc';
    this.validateMap = options.validateMap ?? {};
    this.consumeMap = options.consumeMap ?? {};
  }

  async createTokenForUser(
    userId: string,
    connection?: unknown,
  ): Promise<string> {
    this.createCount += 1;
    this.updatedToken = userId;
    this.createConnections.push(connection ?? null);
    return this.createResult;
  }

  async validateToken(
    token: string,
    connection?: unknown,
  ): Promise<ActivationTokenValidation | null> {
    this.validateCalls += 1;
    this.validateConnectionCalls.push(connection ?? null);
    return this.validateMap[token] ?? null;
  }

  async consumeToken(
    token: string,
    connection?: unknown,
  ): Promise<ActivationTokenValidation | null> {
    this.consumeCalls += 1;
    this.consumeConnectionCalls.push(connection ?? null);
    return this.consumeMap[token] ?? null;
  }
}

class WorkspaceServiceStub {
  public acceptWorkspaceInvitationForRegistrationCalls = 0;
  public acceptedInvites: Array<{
    invitationCode: string;
    userId: string;
    userEmail: string;
    connection?: unknown;
  }> = [];
  public nextAcceptError: string | null = null;

  async acceptWorkspaceInvitationForRegistration(
    invitationCode: string,
    userId: string,
    userEmail: string,
    connection?: unknown,
  ): Promise<unknown> {
    this.acceptWorkspaceInvitationForRegistrationCalls += 1;
    this.acceptedInvites.push({
      invitationCode,
      userId,
      userEmail,
      connection,
    });
    if (this.nextAcceptError) {
      throw new Error(this.nextAcceptError);
    }
    return { invitationId: 'invitation-1' };
  }
}

class FakeMySqlConnection {
  public beginTransactionCalls = 0;
  public commitCalls = 0;
  public rollbackCalls = 0;
  public releaseCalls = 0;

  async beginTransaction(): Promise<void> {
    this.beginTransactionCalls += 1;
  }

  async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  async rollback(): Promise<void> {
    this.rollbackCalls += 1;
  }

  async release(): Promise<void> {
    this.releaseCalls += 1;
  }
}

class FakeMySqlPool {
  public getConnectionCalls = 0;
  public readonly connection = new FakeMySqlConnection();

  async getConnection(): Promise<FakeMySqlConnection> {
    this.getConnectionCalls += 1;
    return this.connection;
  }
}

class FakeUserService {
  public updatedPasswordHash: string | null = null;
  public activatedUserIds: string[] = [];
  public roleGrantedUserIds: string[] = [];
  public createdUsers: PasswordAwareUser[] = [];
  public creationCalls = 0;
  private readonly createdUserId = 'user-1';

  constructor(private readonly user: PasswordAwareUser | null) {}

  async findByEmail(email: string): Promise<PasswordAwareUser | null> {
    if (!this.user || email !== this.user.email) {
      return null;
    }
    return this.user;
  }

  async findById(userId: string): Promise<PasswordAwareUser | null> {
    if (this.user?.userId === userId) {
      return this.user;
    }

    const created = this.createdUsers.find((user) => user.userId === userId);
    return created ?? null;
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

  async createUser(
    email: string,
    nickname: string,
    passwordHash: string,
    activated = true,
  ): Promise<User> {
    this.creationCalls += 1;
    const user = new User(this.createdUserId, email, nickname);
    (user as PasswordAwareUser).passwordHash = passwordHash;
    (user as PasswordAwareUser).activated = activated;
    const created = user as PasswordAwareUser;
    this.createdUsers.push(created);
    return user;
  }

  async createWithPasswordHash(
    email: string,
    nickname: string,
    passwordHash: string,
    activated = true,
  ): Promise<User> {
    return this.createUser(email, nickname, passwordHash, activated);
  }

  async activateUser(userId: string): Promise<void> {
    this.activatedUserIds.push(userId);
  }

  async setUserActivated(userId: string): Promise<void> {
    this.activatedUserIds.push(userId);
  }

  async grantPlatformAdminRole(userId: string): Promise<void> {
    this.roleGrantedUserIds.push(userId);
  }

  async setActivated(userId: string): Promise<void> {
    this.activatedUserIds.push(userId);
  }

  async addRole(): Promise<void> {
    return;
  }
}

class TrackingUserService extends FakeUserService {
  public createConnections: Array<unknown | null> = [];

  async createUser(
    email: string,
    nickname: string,
    passwordHash: string,
    activated = true,
    connection?: unknown,
  ): Promise<User> {
    this.createConnections.push(connection ?? null);
    return super.createUser(email, nickname, passwordHash, activated);
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
  method: 'POST' | 'GET';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  app: express.Express;
}): Request {
  const headers = options.headers ?? {};
  return {
    method: options.method,
    path: options.path,
    body: options.body ?? {},
    app: options.app,
    header: (name: string) =>
      headers[name.toLowerCase()] ??
      headers[name.toUpperCase()] ??
      headers[name] ??
      '',
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
    undefined,
  );
}

function createRegistrationController(
  user: PasswordAwareUser | null,
  acceptedPassword: string,
  captchaService?: CaptchaServiceStub,
  tokenService?: AccountActivationTokenServiceStub,
  resetLogger?: ResetLoggerStub,
  passwordResetTokenService?: PasswordResetTokenServiceStub,
  workspaceService?: WorkspaceServiceStub,
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
    tokenService as unknown,
    undefined as unknown,
    workspaceService as unknown,
  );
}

function createUser(
  email: string,
  hasHash: boolean,
  activated = true,
): PasswordAwareUser {
  const user = new User('user-1', email, 'Alice') as PasswordAwareUser;
  user.passwordHash = hasHash ? 'stored-hash' : null;
  user.activated = activated;
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
  assert.equal(user?.activated, true);
  assert.equal(user && 'password' in user, false);
  assert.equal(user && 'passwordHash' in user, false);
});

test('POST /api/register/captcha returns challenge data without answer', async () => {
  const app = express();
  app.use(express.json());
  const captchaService = new CaptchaServiceStub(
    () => ({
      challengeId: 'register-challenge-id',
      prompt: 'What is the capital of Canada?',
    }),
    true,
  );
  const controller = createRegistrationController(
    null,
    'ignored',
    captchaService,
  );
  controller.register(app);

  const route = getRouteHandlers(app, 'post', '/api/register/captcha');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register/captcha',
    }),
  );

  assert.equal(response.statusCode, 200);
  const body = response.body as {
    ok?: boolean;
    challenge_id?: string;
    challenge_prompt?: string;
    answer?: unknown;
    challenge_answer?: unknown;
  };
  assert.equal(body.ok, true);
  assert.equal(body.challenge_id, 'register-challenge-id');
  assert.equal(body.challenge_prompt, 'What is the capital of Canada?');
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'answer'), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(body, 'challenge_answer'),
    false,
  );
});

test('POST /api/register validates required fields and captcha', async () => {
  const app = express();
  app.use(express.json());
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    false,
  );
  const controller = createRegistrationController(
    null,
    'correct-password',
    captchaService,
  );
  controller.register(app);

  const route = getRouteHandlers(app, 'post', '/api/register');

  const missingEmail = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        nickname: 'Alice',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );
  assert.equal(missingEmail.statusCode, 400);
  assert.equal(
    (missingEmail.body as { error?: string }).error,
    'Email required',
  );

  const missingNickname = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'alice@example.com',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );
  assert.equal(missingNickname.statusCode, 400);
  assert.equal(
    (missingNickname.body as { error?: string }).error,
    'Nickname required',
  );

  const shortPassword = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'alice@example.com',
        nickname: 'Alice',
        password: 'tiny',
        confirm_password: 'tiny',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );
  assert.equal(shortPassword.statusCode, 400);
  assert.equal(
    (shortPassword.body as { error?: string }).error,
    'Password is too short',
  );

  const mismatchedPassword = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'alice@example.com',
        nickname: 'Alice',
        password: 'long-enough-password',
        confirm_password: 'different-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );
  assert.equal(mismatchedPassword.statusCode, 400);
  assert.equal(
    (mismatchedPassword.body as { error?: string }).error,
    'Password confirmation does not match',
  );

  const invalidCaptcha = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'alice@example.com',
        nickname: 'Alice',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );
  assert.equal(invalidCaptcha.statusCode, 400);
  assert.equal(
    (invalidCaptcha.body as { error?: string }).error,
    'Invalid captcha',
  );
});

test('POST /api/register returns duplicate email as 409 when user exists', async () => {
  const app = express();
  app.use(express.json());
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    true,
  );
  const controller = createRegistrationController(
    createUser('alice@example.com', true),
    'correct-password',
    captchaService,
  );
  controller.register(app);

  const route = getRouteHandlers(app, 'post', '/api/register');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'alice@example.com',
        nickname: 'Alice',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );

  assert.equal(response.statusCode, 409);
  assert.equal(
    (response.body as { error?: string }).error,
    'Email already registered',
  );
});

test('POST /api/register creates user, token, and returns authenticated non-activated payload', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    createResult: 'activation-token-abc',
  });
  const logger = new ResetLoggerStub();
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    true,
  );

  const userService = new FakeUserService(null);
  const passwordService = new PasswordServiceStub('correct-password');
  const jwtService = new FakeJwtAuthService(3600);

  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    jwtService as unknown,
    passwordService as unknown,
    captchaService as unknown,
    undefined as unknown,
    logger as unknown,
    tokenService as unknown,
  );
  controller.register(app);

  const route = getRouteHandlers(app, 'post', '/api/register');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'new@example.com',
        nickname: '  New User  ',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
  const body = response.body as Record<string, unknown>;
  assert.equal(
    Object.prototype.hasOwnProperty.call(body, 'activation_url'),
    false,
  );
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'reset_url'), false);
  assert.equal(body.token, 'token-user-1-1');
  assert.equal(body.token_type, 'Bearer');
  assert.equal(body.expires_in_seconds, 3600);
  assert.deepEqual(body.user, {
    id: 'user-1',
    userId: 'user-1',
    email: 'new@example.com',
    nickname: 'New User',
    activated: false,
  });
  assert.equal(tokenService.createCount, 1);
  assert.equal(tokenService.updatedToken, 'user-1');
  assert.equal(userService.activatedUserIds.length, 0);
  assert.equal(userService.creationCalls, 1);
  assert.equal(userService.createdUsers[0]?.email, 'new@example.com');
  assert.equal(userService.createdUsers[0]?.nickname, 'New User');
  assert.equal(
    logger.messages.some((message) =>
      message.message.includes('/activate-account/activation-token-abc'),
    ),
    true,
  );
});

test('POST /api/register accepts a valid invitation code and creates workspace membership in the registration transaction', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    createResult: 'activation-token-abc',
  });
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    true,
  );
  const userService = new TrackingUserService(null);
  const passwordService = new PasswordServiceStub('correct-password');
  const jwtService = new FakeJwtAuthService(3600);
  const workspaceService = new WorkspaceServiceStub();
  const pool = new FakeMySqlPool();

  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    jwtService as unknown,
    passwordService as unknown,
    captchaService as unknown,
    undefined as unknown,
    undefined as unknown,
    tokenService as unknown,
    undefined as unknown,
    pool as unknown,
    workspaceService as unknown,
  );

  controller.register(app);
  const route = getRouteHandlers(app, 'post', '/api/register');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'invitee@example.com',
        nickname: 'Invited User',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
        invitation_code: 'invite-code',
      },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
  assert.equal(userService.creationCalls, 1);
  assert.equal(workspaceService.acceptWorkspaceInvitationForRegistrationCalls, 1);
  assert.equal(workspaceService.acceptedInvites[0].invitationCode, 'invite-code');
  assert.equal(
    workspaceService.acceptedInvites[0].userEmail,
    'invitee@example.com',
  );
  assert.equal(tokenService.createCount, 1);
  assert.equal(pool.connection.beginTransactionCalls, 1);
  assert.equal(pool.connection.commitCalls, 1);
  assert.equal(pool.connection.rollbackCalls, 0);
  assert.equal(pool.connection.releaseCalls, 1);
  assert.equal(
    workspaceService.acceptedInvites[0].connection,
    tokenService.createConnections[0],
    'invitation acceptance and activation token should share the same connection',
  );
});

test('POST /api/register rejects invitation registration when invitation email does not match', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    createResult: 'activation-token-abc',
  });
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    true,
  );
  const userService = new TrackingUserService(null);
  const passwordService = new PasswordServiceStub('correct-password');
  const jwtService = new FakeJwtAuthService(3600);
  const workspaceService = new WorkspaceServiceStub();
  workspaceService.nextAcceptError = 'Invitation email mismatch';
  const pool = new FakeMySqlPool();

  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    jwtService as unknown,
    passwordService as unknown,
    captchaService as unknown,
    undefined as unknown,
    undefined as unknown,
    tokenService as unknown,
    undefined as unknown,
    pool as unknown,
    workspaceService as unknown,
  );

  controller.register(app);
  const route = getRouteHandlers(app, 'post', '/api/register');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'other@example.com',
        nickname: 'Invited User',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
        invitationCode: 'invite-code',
      },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(
    (response.body as { error?: string }).error,
    'Invitation email mismatch',
  );
  assert.equal(workspaceService.acceptWorkspaceInvitationForRegistrationCalls, 1);
  assert.equal(pool.connection.beginTransactionCalls, 1);
  assert.equal(pool.connection.rollbackCalls, 1);
  assert.equal(pool.connection.commitCalls, 0);
  assert.equal(pool.connection.releaseCalls, 1);
});

test('POST /api/register rejects invalid invitation code with a 400', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    createResult: 'activation-token-abc',
  });
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    true,
  );
  const userService = new TrackingUserService(null);
  const passwordService = new PasswordServiceStub('correct-password');
  const jwtService = new FakeJwtAuthService(3600);
  const workspaceService = new WorkspaceServiceStub();
  workspaceService.nextAcceptError = 'Invalid invitation code';
  const pool = new FakeMySqlPool();

  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    jwtService as unknown,
    passwordService as unknown,
    captchaService as unknown,
    undefined as unknown,
    undefined as unknown,
    tokenService as unknown,
    undefined as unknown,
    pool as unknown,
    workspaceService as unknown,
  );

  controller.register(app);
  const route = getRouteHandlers(app, 'post', '/api/register');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'invitee@example.com',
        nickname: 'Invited User',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
        invitationCode: 'invite-code',
      },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(
    (response.body as { error?: string }).error,
    'Invalid invitation code',
  );
  assert.equal(pool.connection.beginTransactionCalls, 1);
  assert.equal(pool.connection.rollbackCalls, 1);
  assert.equal(pool.connection.commitCalls, 0);
  assert.equal(pool.connection.releaseCalls, 1);
});

test('POST /api/register uses one production transaction when a DB pool is available', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    createResult: 'activation-token-abc',
  });
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    true,
  );
  const userService = new TrackingUserService(null);
  const passwordService = new PasswordServiceStub('correct-password');
  const jwtService = new FakeJwtAuthService(3600);
  const pool = new FakeMySqlPool();
  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    jwtService as unknown,
    passwordService as unknown,
    captchaService as unknown,
    undefined as unknown,
    undefined as unknown,
    tokenService as unknown,
    undefined as unknown,
    pool as unknown,
  );

  controller.register(app);
  const route = getRouteHandlers(app, 'post', '/api/register');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/register',
      body: {
        email: 'new@example.com',
        nickname: 'New User',
        password: 'long-enough-password',
        confirm_password: 'long-enough-password',
        challenge_id: 'register-challenge-id',
        challenge_answer: '2',
      },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
  assert.equal(pool.getConnectionCalls, 1);
  assert.equal(pool.connection.beginTransactionCalls, 1);
  assert.equal(pool.connection.commitCalls, 1);
  assert.equal(pool.connection.rollbackCalls, 0);
  assert.equal(pool.connection.releaseCalls, 1);
  assert.equal(userService.creationCalls, 1);
  assert.equal(tokenService.createCount, 1);
  assert.equal(
    userService.createConnections[0],
    tokenService.createConnections[0],
    'user and activation token creation should share the same connection',
  );
});

test('POST /api/register rolls back and releases connection when activation token creation fails in production', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    createResult: 'activation-token-abc',
  });
  tokenService.createTokenForUser = async (
    _userId: string,
    _connection?: unknown,
  ) => {
    tokenService.createCount += 1;
    tokenService.createConnections.push(_connection ?? null);
    throw new Error('creation failed');
  };
  const captchaService = new CaptchaServiceStub(
    () => ({ challengeId: 'register-challenge-id', prompt: '1 + 1?' }),
    true,
  );
  const userService = new TrackingUserService(null);
  const passwordService = new PasswordServiceStub('correct-password');
  const jwtService = new FakeJwtAuthService(3600);
  const pool = new FakeMySqlPool();
  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    jwtService as unknown,
    passwordService as unknown,
    captchaService as unknown,
    undefined as unknown,
    undefined as unknown,
    tokenService as unknown,
    undefined as unknown,
    pool as unknown,
  );

  controller.register(app);
  const route = getRouteHandlers(app, 'post', '/api/register');

  await assert.rejects(async () => {
    await runHandlers(
      route,
      createRequest({
        app,
        method: 'POST',
        path: '/api/register',
        body: {
          email: 'new@example.com',
          nickname: 'New User',
          password: 'long-enough-password',
          confirm_password: 'long-enough-password',
          challenge_id: 'register-challenge-id',
          challenge_answer: '2',
        },
      }),
    );
  }, /creation failed/);

  assert.equal(pool.getConnectionCalls, 1);
  assert.equal(pool.connection.beginTransactionCalls, 1);
  assert.equal(pool.connection.commitCalls, 0);
  assert.equal(pool.connection.rollbackCalls, 1);
  assert.equal(pool.connection.releaseCalls, 1);
  assert.equal(userService.creationCalls, 1);
});

test('POST /api/login includes activation state in user payload', async () => {
  const app = express();
  app.use(express.json());
  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    new FakeUserService(createUser('alice@example.com', true)),
    new FakeJwtAuthService(3600),
    new PasswordServiceStub('correct-password'),
    new CaptchaServiceStub(
      () => ({ challengeId: 'register-challenge-id', prompt: 'ignored' }),
      true,
    ),
    undefined as unknown,
    undefined as unknown,
    undefined as unknown,
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

  assert.equal(response.statusCode, 200);
  const user = (response.body as { user?: { activated?: boolean } }).user;
  assert.equal(user?.activated, true);
});

test('GET /api/me includes activation state in current identity payload', async () => {
  const app = express();
  app.use(express.json());
  const userService = new FakeUserService(
    createUser('alice@example.com', true, false),
  );
  const jwtService = new FakeJwtAuthService(3600);
  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    jwtService as unknown,
    new PasswordServiceStub('correct-password'),
    new CaptchaServiceStub(
      () => ({ challengeId: 'register-challenge-id', prompt: 'ignored' }),
      true,
    ),
    undefined as unknown,
    undefined as unknown,
    undefined as unknown,
  );
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const loginResponse = await runHandlers(
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

  const token = (loginResponse.body as { token?: string }).token as string;
  const response = await runHandlers(
    getRouteHandlers(app, 'get', '/api/me'),
    createRequest({
      app,
      method: 'GET',
      path: '/api/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
  );
  assert.equal(response.statusCode, 200);
  const body = response.body as {
    activated?: boolean;
    id?: string;
  };
  assert.equal(body.id, 'user-1');
  assert.equal(body.activated, false);
});

test('POST /api/account-activation validates token outcome states', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    validateMap: {
      validToken: { tokenId: 'token-1', userId: 'user-1' },
      expiredToken: null,
      usedToken: null,
      invalidToken: null,
    },
  });
  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    new FakeUserService(createUser('alice@example.com', true)),
    new FakeJwtAuthService(3600),
    new PasswordServiceStub('correct-password'),
    new CaptchaServiceStub(
      () => ({ challengeId: 'register-challenge-id', prompt: 'ignored' }),
      true,
    ),
    undefined as unknown,
    undefined as unknown,
    tokenService as unknown,
  );
  controller.register(app);

  const route = getRouteHandlers(
    app,
    'post',
    '/api/account-activation/validate',
  );
  const missing = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/account-activation/validate',
      body: {},
    }),
  );
  assert.equal(missing.statusCode, 400);
  assert.equal(
    (missing.body as { error?: string }).error,
    'Invalid activation token',
  );

  const valid = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/account-activation/validate',
      body: {
        token: 'validToken',
      },
    }),
  );
  assert.equal(valid.statusCode, 200);
  assert.equal((valid.body as { ok?: boolean }).ok, true);

  const expired = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/account-activation/validate',
      body: {
        token: 'expiredToken',
      },
    }),
  );
  assert.equal(expired.statusCode, 400);
  assert.equal(
    (expired.body as { error?: string }).error,
    'Invalid activation token',
  );

  const used = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/account-activation/validate',
      body: {
        token: 'usedToken',
      },
    }),
  );
  assert.equal(used.statusCode, 400);
  assert.equal(
    (used.body as { error?: string }).error,
    'Invalid activation token',
  );

  const invalid = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/account-activation/validate',
      body: {
        token: 'invalidToken',
      },
    }),
  );
  assert.equal(invalid.statusCode, 400);
  assert.equal(
    (invalid.body as { error?: string }).error,
    'Invalid activation token',
  );
});

test('POST /api/account-activation activates user, grants role, and marks token used', async () => {
  const app = express();
  app.use(express.json());
  const tokenService = new AccountActivationTokenServiceStub({
    consumeMap: {
      validToken: { tokenId: 'token-1', userId: 'user-1' },
    },
  });
  const userService = new FakeUserService(
    createUser('alice@example.com', true, false),
  );
  const logger = new ResetLoggerStub();

  const controller = new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    new FakeJwtAuthService(3600),
    new PasswordServiceStub('correct-password'),
    new CaptchaServiceStub(
      () => ({ challengeId: 'register-challenge-id', prompt: 'ignored' }),
      true,
    ),
    undefined as unknown,
    logger as unknown,
    tokenService as unknown,
    undefined as unknown,
  );
  controller.register(app);

  const route = getRouteHandlers(app, 'post', '/api/account-activation');
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/account-activation',
      body: {
        token: 'validToken',
      },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
  assert.equal((response.body as { token?: string }).token, 'token-user-1-1');
  assert.equal((response.body as { token_type?: string }).token_type, 'Bearer');
  assert.equal(
    (response.body as { expires_in_seconds?: number }).expires_in_seconds,
    3600,
  );
  assert.deepEqual((response.body as { user?: unknown }).user, {
    id: 'user-1',
    userId: 'user-1',
    email: 'alice@example.com',
    nickname: 'Alice',
    activated: true,
  });
  assert.equal(tokenService.consumeCalls, 1);
  assert.equal(userService.activatedUserIds.includes('user-1'), true);
  assert.equal(userService.roleGrantedUserIds.includes('user-1'), true);
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
      body: {
        token: 'resetToken',
        password: 'tiny',
        confirm_password: 'tiny',
      },
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
      body: {
        token: 'resetToken',
        password: 'longer-password',
        confirm_password: 'longer-password',
      },
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

test('POST /api/password-reset requires confirmation password before token consumption', async () => {
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
  const fakePasswordService = new PasswordServiceStub('any-password');
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
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset',
      body: {
        token: 'resetToken',
        password: 'longer-password',
      },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(
    (response.body as { error?: string }).error,
    'Password confirmation required',
  );
  assert.equal(fakePasswordService.hashPasswordCalls, 0);
  assert.equal(tokenService.consumeCount, 0);
  assert.equal(userService.updatedPasswordHash, null);
});

test('POST /api/password-reset rejects mismatched confirmation before token consumption', async () => {
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
  const fakePasswordService = new PasswordServiceStub('any-password');
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
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/password-reset',
      body: {
        token: 'resetToken',
        password: 'longer-password',
        confirm_password: 'different-password',
      },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(
    (response.body as { error?: string }).error,
    'Password confirmation does not match',
  );
  assert.equal(fakePasswordService.hashPasswordCalls, 0);
  assert.equal(tokenService.consumeCount, 0);
  assert.equal(userService.updatedPasswordHash, null);
});
