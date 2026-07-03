import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { AuthController } from '../../controllers/AuthController';
import { User } from '../../entities/User';

type LoggerMessage = {
  message: string;
  params: Array<unknown>;
};

type HttpResponse = {
  statusCode: number;
  body: unknown;
};

type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | void;

type GooglePayload = {
  iss?: string;
  aud?: string | string[];
  sub?: string | null;
  email?: string | null;
  email_verified?: boolean;
  hd?: string | null;
  name?: string | null;
};

type GoogleAwareUser = User & {
  passwordHash?: string | null;
  googleSubject?: string | null;
};

class FakeJwtAuthService {
  private issueCount = 0;
  private readonly issued = new Map<
    string,
    {
      userId: string;
      email: string;
      nickname: string;
      activated: boolean;
    }
  >();

  constructor(private readonly jwtExpiresInSeconds: number) {}

  async issueToken(identity: {
    userId: string;
    email: string;
    nickname: string;
    activated: boolean;
  }): Promise<string> {
    const token = `token-${identity.userId}-${++this.issueCount}`;
    this.issued.set(token, identity);
    return token;
  }

  async verifyToken(token: string): Promise<{
    userId: string;
    email: string;
    nickname: string;
    activated: boolean;
  }> {
    const identity = this.issued.get(token);
    if (!identity) {
      throw new Error('Invalid token');
    }
    return identity;
  }

  getExpiresInSeconds(): number {
    return this.jwtExpiresInSeconds;
  }
}

class PasswordServiceStub {
  async hashPassword(password: string): Promise<string> {
    return `hash-${password}`;
  }

  async verifyPassword(): Promise<boolean> {
    return false;
  }

  validatePassword(): boolean {
    return true;
  }
}

class CaptchaServiceStub {
  async createChallenge(): Promise<{ challengeId: string; prompt: string }> {
    return { challengeId: 'challenge-id', prompt: 'unused' };
  }

  async validateChallenge(): Promise<boolean> {
    return true;
  }
}

class ResetLoggerStub {
  public messages: LoggerMessage[] = [];

  info(message: string, ...params: Array<unknown>): void {
    this.messages.push({ message, params });
  }
}

class FakeGoogleVerifier {
  public verifyCalls = 0;
  public result: GooglePayload | null = null;
  public error: string | null = null;

  setResult(payload: GooglePayload | null): void {
    this.result = payload;
  }

  setError(message: string | null): void {
    this.error = message;
  }

  async verifyIdToken(
    credential: string,
  ): Promise<{ payload: GooglePayload } | null> {
    this.verifyCalls += 1;
    assert.ok(credential, 'credential should be forwarded to verifier');

    if (this.error) {
      throw new Error(this.error);
    }
    if (!this.result) {
      return null;
    }

    return { payload: this.result };
  }
}

class FakeUserService {
  public findByGoogleSubjectCalls: string[] = [];
  public findByEmailCalls: string[] = [];
  public findByEmailConnections: Array<unknown | null> = [];
  public findByIdCalls: string[] = [];
  public linkCalls: string[] = [];
  public createCalls: number[] = [];
  public setActivatedCalls: string[] = [];
  public grantRoleCalls: string[] = [];

  private createdUsersCount = 0;
  private readonly usersByEmail = new Map<string, GoogleAwareUser>();
  private readonly usersById = new Map<string, GoogleAwareUser>();
  private readonly usersByGoogleSubject = new Map<string, GoogleAwareUser>();

  constructor(seed: GoogleAwareUser[] = []) {
    for (const user of seed) {
      this.addUser(user);
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private addUser(user: GoogleAwareUser): GoogleAwareUser {
    const normalizedEmail = this.normalizeEmail(user.email);
    const stored: GoogleAwareUser = {
      ...user,
      email: normalizedEmail,
      activated: user.activated,
      passwordHash: user.passwordHash,
      googleSubject: user.googleSubject,
    };

    this.usersByEmail.set(normalizedEmail, stored);
    this.usersById.set(stored.userId, stored);
    if (stored.googleSubject) {
      this.usersByGoogleSubject.set(stored.googleSubject, stored);
    }

    return stored;
  }

  async findByEmail(email: string, connection?: unknown): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    this.findByEmailCalls.push(normalizedEmail);
    this.findByEmailConnections.push(connection ?? null);
    return this.usersByEmail.get(normalizedEmail) || null;
  }

  async findById(userId: string): Promise<User | null> {
    this.findByIdCalls.push(userId);
    return this.usersById.get(userId) || null;
  }

  async findByGoogleSubject(subject: string): Promise<User | null> {
    this.findByGoogleSubjectCalls.push(subject);
    return this.usersByGoogleSubject.get(subject) || null;
  }

  async createUser(
    email: string,
    nickname: string,
    _passwordHash: string,
    activated = true,
  ): Promise<User> {
    this.createCalls.push(1);
    const userId = `user-${++this.createdUsersCount}`;
    const user = new User(
      userId,
      this.normalizeEmail(email),
      nickname,
      activated ? new Date() : null,
    ) as GoogleAwareUser;
    user.passwordHash = _passwordHash;
    this.addUser(user);
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

  async setUserActivated(userId: string, activated = true): Promise<void> {
    this.setActivatedCalls.push(userId);
    const user = this.usersById.get(userId);
    if (user) {
      user.activated = activated;
      this.usersByEmail.set(user.email, user);
    }
  }

  async grantPlatformAdminRole(userId: string): Promise<void> {
    this.grantRoleCalls.push(userId);
  }

  async linkGoogleSubjectToUser(
    userId: string,
    googleSubject: string,
  ): Promise<void> {
    this.linkCalls.push(`${userId}:${googleSubject}`);

    const user = this.usersById.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const existingForSubject = this.usersByGoogleSubject.get(googleSubject);
    if (existingForSubject && existingForSubject.userId !== userId) {
      throw new Error('Google subject already linked to another user');
    }

    if (user.googleSubject && user.googleSubject !== googleSubject) {
      throw new Error('Google subject already linked for user');
    }

    user.googleSubject = googleSubject;
    this.usersByGoogleSubject.set(googleSubject, user);
  }
}

class DuplicateSubjectUserService extends FakeUserService {
  async linkGoogleSubjectToUser(): Promise<void> {
    throw new Error('ER_DUP_ENTRY: Duplicate entry for key \'google_subject\'');
  }
}

class FakeAccountActivationTokenService {
  public createCount = 0;
  public consumeCount = 0;
  public createTokenForUserResult = 'activation-token-1';

  async createTokenForUser(): Promise<string> {
    this.createCount += 1;
    return this.createTokenForUserResult;
  }

  async consumeToken(): Promise<{ tokenId: string; userId: string } | null> {
    this.consumeCount += 1;
    return null;
  }
}

class FakeWorkspaceService {
  public acceptWorkspaceInvitationForRegistrationCalls: string[] = [];

  async acceptWorkspaceInvitationForRegistration(
    invitationCode: string,
  ): Promise<void> {
    this.acceptWorkspaceInvitationForRegistrationCalls.push(invitationCode);
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
  public readonly connection = new FakeMySqlConnection();
  public getConnectionCalls = 0;

  async getConnection(): Promise<FakeMySqlConnection> {
    this.getConnectionCalls += 1;
    return this.connection;
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

function getGoogleAuthHandlers(app: express.Express): RouteHandler[] {
  const routeLayer = (
    app as unknown as { _router: { stack: unknown[] } }
  )._router.stack.find((layer) => {
    const route = (
      layer as { route?: { path?: string; methods?: Record<string, boolean> } }
    ).route;
    return route?.methods?.post === true && route.path === '/api/google-auth';
  }) as
    | {
        route: {
          stack: Array<{ handle: RouteHandler }>;
        };
      }
    | undefined;

  assert.ok(routeLayer, 'POST /api/google-auth route is not registered');
  return routeLayer.route.stack.map((entry) => entry.handle);
}

function createRequest(options: {
  method: 'POST';
  path: string;
  app: express.Express;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}): Request {
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };
  if (options.cookies) {
    headers.cookie = Object.entries(options.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  return {
    method: options.method,
    path: options.path,
    body: options.body ?? {},
    app: options.app,
    header(name: string) {
      return (
        headers[name.toLowerCase()] ??
        headers[name.toUpperCase()] ??
        headers[name] ??
        ''
      );
    },
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

async function runGoogleAuth(
  app: express.Express,
  body: Record<string, unknown>,
  cookies?: Record<string, string>,
): Promise<HttpResponse> {
  const handlers = getGoogleAuthHandlers(app);
  return runHandlers(
    handlers,
    createRequest({
      app,
      method: 'POST',
      path: '/api/google-auth',
      body,
      cookies,
    }),
  );
}

async function withGoogleClientId(
  value: string | undefined,
  fn: () => Promise<void>,
): Promise<void> {
  const previous = process.env.GOOGLE_AUTH_CLIENT_ID;
  try {
    if (typeof value === 'undefined') {
      delete process.env.GOOGLE_AUTH_CLIENT_ID;
    } else {
      process.env.GOOGLE_AUTH_CLIENT_ID = value;
    }

    await fn();
  } finally {
    if (typeof previous === 'undefined') {
      delete process.env.GOOGLE_AUTH_CLIENT_ID;
    } else {
      process.env.GOOGLE_AUTH_CLIENT_ID = previous;
    }
  }
}

function createController(
  userService: FakeUserService,
  googleVerifier: FakeGoogleVerifier,
  accountActivationTokenService = new FakeAccountActivationTokenService(),
  workspaceService = new FakeWorkspaceService(),
  resetLogger = new ResetLoggerStub(),
): AuthController {
  return new (AuthController as unknown as {
    new (...args: unknown[]): AuthController;
  })(
    userService as unknown,
    new FakeJwtAuthService(3600) as unknown,
    new PasswordServiceStub() as unknown,
    new CaptchaServiceStub() as unknown,
    undefined as unknown,
    resetLogger as unknown,
    accountActivationTokenService as unknown,
    undefined as unknown,
    new FakeMySqlPool() as unknown,
    workspaceService as unknown,
    googleVerifier as unknown,
  );
}

function getErrorBody(body: unknown): string {
  return typeof (body as { error?: string }).error === 'string'
    ? ((body as { error?: string }).error as string)
    : '';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createGoogleAwareUser(input: {
  userId: string;
  email: string;
  nickname: string;
  activated?: boolean;
  passwordHash?: string | null;
  googleSubject?: string | null;
}): GoogleAwareUser {
  const user = new User(
    input.userId,
    input.email,
    input.nickname,
    input.activated === false ? null : new Date(),
    input.googleSubject ?? null,
  ) as GoogleAwareUser;
  user.activated = input.activated ?? true;
  user.passwordHash = input.passwordHash;
  user.googleSubject = input.googleSubject ?? null;
  return user;
}

test('POST /api/google-auth rejects request when Google client ID is missing', async () => {
  const app = express();
  app.use(express.json());

  const userService = new FakeUserService();
  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-disabled',
    email: 'disabled@example.com',
    email_verified: true,
  });
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId(undefined, async () => {
    const response = await runGoogleAuth(app, {
      credential: 'google-id-token',
      g_csrf_token: 'csrf-token',
    });

    assert.equal(response.statusCode >= 400, true);
    assert.equal(
      getErrorBody(response.body).toLowerCase().includes('google'),
      true,
    );
    assert.equal(verifier.verifyCalls, 0);
  });
});

test('POST /api/google-auth requires a credential', async () => {
  const app = express();
  app.use(express.json());

  const userService = new FakeUserService();
  const verifier = new FakeGoogleVerifier();
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 400);
    assert.equal(
      getErrorBody(response.body).toLowerCase().includes('credential'),
      true,
    );
    assert.equal(verifier.verifyCalls, 0);
  });
});

test('POST /api/google-auth rejects CSRF token mismatch', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-csrf',
    email: 'csrf@example.com',
    email_verified: true,
  });
  const userService = new FakeUserService();
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'body-token',
      },
      {
        g_csrf_token: 'cookie-token',
      },
    );

    assert.equal(response.statusCode, 400);
    assert.equal(
      getErrorBody(response.body).toLowerCase().includes('csrf'),
      true,
    );
    assert.equal(verifier.verifyCalls, 0);
  });
});

test('POST /api/google-auth rejects an invalid Google credential result', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult(null);
  const userService = new FakeUserService();
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 400);
    assert.equal(
      getErrorBody(response.body).toLowerCase().includes('invalid'),
      true,
    );
    assert.equal(verifier.verifyCalls, 1);
  });
});

test('POST /api/google-auth rejects verifier throw during verification', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setError('verification failed');
  const userService = new FakeUserService();
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 400);
    assert.equal(
      getErrorBody(response.body).toLowerCase().includes('verification'),
      true,
    );
    assert.equal(verifier.verifyCalls, 1);
  });
});

test('POST /api/google-auth creates authoritative new users as activated with platform admin', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-authoritative',
    email: 'NewUser@Example.COM',
    email_verified: true,
    name: 'New User',
    hd: 'example.com',
  });

  const userService = new FakeUserService();
  const tokenService = new FakeAccountActivationTokenService();
  const controller = createController(userService, verifier, tokenService);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { ok?: boolean }).ok, true);

    const body = response.body as {
      user?: {
        id?: string;
        email?: string;
        activated?: boolean;
      };
    };
    assert.equal(body.user?.email, normalizeEmail('NewUser@Example.COM'));
    assert.equal(body.user?.activated, true);
    assert.equal(tokenService.createCount, 0);
    assert.equal(userService.createCalls.length, 1);
    assert.equal(userService.grantRoleCalls.length, 1);
    assert.equal(verifier.verifyCalls, 1);
  });
});

test('POST /api/google-auth creates non-authoritative new users as inactive without logging activation URL', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-non-authoritative',
    email: 'pending@example.com',
    email_verified: false,
    name: 'Pending User',
  });

  const resetLogger = new ResetLoggerStub();
  const tokenService = new FakeAccountActivationTokenService();
  tokenService.createTokenForUserResult = 'activate-token-1';
  const userService = new FakeUserService();
  const controller = createController(
    userService,
    verifier,
    tokenService,
    new FakeWorkspaceService(),
    resetLogger,
  );
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 200);
    const body = response.body as {
      user?: {
        activated?: boolean;
      };
    };
    assert.equal(body.user?.activated, false);
    assert.equal(tokenService.createCount, 1);
    assert.equal(
      resetLogger.messages.some((entry) =>
        String(entry.message).includes('/activate-account/'),
      ),
      false,
    );
    assert.equal(verifier.verifyCalls, 1);
  });
});

test('POST /api/google-auth links existing user by normalized email when no Google subject exists', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-match-by-email',
    email: '  Existing@Example.COM ',
    email_verified: false,
    name: 'Existing User',
  });

  const seeded = new User(
    'user-10',
    'existing@example.com',
    'Existing',
    new Date(),
  ) as GoogleAwareUser;
  seeded.activated = true;
  seeded.passwordHash = 'stored-hash';

  const userService = new FakeUserService([seeded]);
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 200);
    const body = response.body as {
      user?: {
        id?: string;
        email?: string;
      };
    };
    assert.equal(body.user?.id, 'user-10');
    assert.equal(body.user?.email, normalizeEmail('existing@example.com'));
    assert.equal(userService.linkCalls[0], 'user-10:sub-match-by-email');
    assert.equal(userService.createCalls.length, 0);
    assert.equal(verifier.verifyCalls, 1);
  });
});

test('POST /api/google-auth signs in a Google-linked user by Google subject first', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-linked',
    email: 'other@example.com',
    email_verified: true,
  });

  const seededLinked = createGoogleAwareUser({
    userId: 'user-11',
    email: 'linked@example.com',
    nickname: 'Linked',
    activated: true,
    passwordHash: 'stored-hash',
    googleSubject: 'sub-linked',
  });
  const seededOther = createGoogleAwareUser({
    userId: 'user-12',
    email: 'other@example.com',
    nickname: 'Email User',
    activated: true,
    passwordHash: 'stored-hash',
  });
  const userService = new FakeUserService([seededLinked, seededOther]);
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 200);
    const body = response.body as {
      user?: {
        id?: string;
      };
    };
    assert.equal(body.user?.id, 'user-11');
    assert.equal(userService.createCalls.length, 0);
    assert.equal(userService.linkCalls.length, 0);
    assert.equal(userService.findByGoogleSubjectCalls[0], 'sub-linked');
    assert.equal(verifier.verifyCalls, 1);
  });
});

test('POST /api/google-auth rejects user subject linkage conflicts', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-conflict',
    email: 'conflict@example.com',
    email_verified: false,
  });

  const seeded = createGoogleAwareUser({
    userId: 'user-20',
    email: 'conflict@example.com',
    nickname: 'Conflicted',
    activated: false,
    passwordHash: 'stored-hash',
    googleSubject: 'existing-sub',
  });
  const userService = new FakeUserService([seeded]);
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 409);
    assert.equal(
      getErrorBody(response.body).toLowerCase().includes('google subject'),
      true,
    );
    assert.equal(userService.createCalls.length, 0);
  });
});

test('POST /api/google-auth accepts invitation codes for new Google users', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-invite',
    email: 'invitee@example.com',
    email_verified: false,
  });

  const tokenService = new FakeAccountActivationTokenService();
  const workspaceService = new FakeWorkspaceService();
  const userService = new FakeUserService();
  const controller = createController(
    userService,
    verifier,
    tokenService,
    workspaceService,
  );
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
        invitation_code: 'workspace-invite-code',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 200);
    assert.equal(
      workspaceService.acceptWorkspaceInvitationForRegistrationCalls[0],
      'workspace-invite-code',
    );
  });
});

test('POST /api/google-auth does not accept invitation code for an existing user automatically', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-existing',
    email: 'existing@example.com',
    email_verified: true,
  });

  const seeded = createGoogleAwareUser({
    userId: 'user-30',
    email: 'existing@example.com',
    nickname: 'Existing',
    activated: true,
    passwordHash: 'stored-hash',
    googleSubject: 'sub-existing',
  });
  const workspaceService = new FakeWorkspaceService();
  const userService = new FakeUserService([seeded]);
  const controller = createController(
    userService,
    verifier,
    undefined,
    workspaceService,
  );
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
        invitation_code: 'workspace-invite-code',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 200);
    assert.equal(
      workspaceService.acceptWorkspaceInvitationForRegistrationCalls.length,
      0,
    );
    assert.equal(userService.createCalls.length, 0);
  });
});

test('POST /api/google-auth rate limits repeated credential attempts', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-rate-limit',
    email: 'rate-limit@example.com',
    email_verified: true,
    hd: 'example.com',
  });
  const userService = new FakeUserService();
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    let response: HttpResponse | null = null;
    for (let index = 0; index < 11; index += 1) {
      response = await runGoogleAuth(
        app,
        {
          credential: 'same-google-id-token',
          g_csrf_token: 'csrf-token',
        },
        {
          g_csrf_token: 'csrf-token',
        },
      );
    }

    assert.equal(response?.statusCode, 429);
    assert.equal(
      getErrorBody(response?.body).toLowerCase().includes('too many'),
      true,
    );
  });
});

test('POST /api/google-auth uses transaction connection for email lookup', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-transactional-email',
    email: 'transactional@example.com',
    email_verified: false,
  });
  const userService = new FakeUserService();
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 200);
    assert.notEqual(userService.findByEmailConnections[0], null);
  });
});

test('POST /api/google-auth maps DB duplicate google_subject errors to conflict', async () => {
  const app = express();
  app.use(express.json());

  const verifier = new FakeGoogleVerifier();
  verifier.setResult({
    sub: 'sub-db-conflict',
    email: 'db-conflict@example.com',
    email_verified: true,
    hd: 'example.com',
  });
  const seeded = createGoogleAwareUser({
    userId: 'user-db-conflict',
    email: 'db-conflict@example.com',
    nickname: 'Conflict',
    activated: true,
    passwordHash: 'stored-hash',
  });
  const userService = new DuplicateSubjectUserService([seeded]);
  const controller = createController(userService, verifier);
  controller.register(app);

  await withGoogleClientId('test-google-client-id', async () => {
    const response = await runGoogleAuth(
      app,
      {
        credential: 'google-id-token',
        g_csrf_token: 'csrf-token',
      },
      {
        g_csrf_token: 'csrf-token',
      },
    );

    assert.equal(response.statusCode, 409);
    assert.equal(
      getErrorBody(response.body).toLowerCase().includes('duplicate'),
      true,
    );
  });
});
