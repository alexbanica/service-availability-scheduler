import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { AuthController } from '../../controllers/AuthController';
import { requireAuth } from '../../controllers/AuthMiddleware';
import { User } from '../../entities/User';

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
  private readonly issued: Map<string, JwtUserIdentity> = new Map();

  constructor(public readonly jwtExpiresInSeconds: number) {}

  getExpiresInSeconds(): number {
    return this.jwtExpiresInSeconds;
  }

  async issueToken(identity: JwtUserIdentity): Promise<string> {
    const token = `token-${++this.issueCount}`;
    this.issued.set(token, identity);
    return token;
  }

  async verifyToken(token: string): Promise<JwtUserIdentity> {
    if (token === 'invalid-token' || token === 'expired-token') {
      throw new Error('Invalid token');
    }
    const identity = this.issued.get(token);
    if (!identity) {
      throw new Error('Invalid token');
    }
    return identity;
  }
}

class FakeUserService {
  async getNicknamesByIds(_ids: string[]): Promise<Map<string, string>> {
    return new Map();
  }

  async findByEmail(email: string): Promise<User | null> {
    if (email === 'alice@example.com') {
      return new User('user-1', email, 'Alice');
    }
    return null;
  }
}

function createAuthController(jwtService: FakeJwtAuthService): AuthController {
  return new (AuthController as unknown as {
    new (...args: [unknown, unknown]): AuthController;
  })(new FakeUserService() as unknown, jwtService);
}

function getRouteHandlers(
  app: express.Express,
  method: 'get' | 'post' | 'patch',
  path: string,
): RouteHandler[] {
  const routeLayer = (app as unknown as { _router: { stack: unknown[] } })._router.stack
    .find((layer) => {
      const route = (layer as { route?: { path?: string; methods?: Record<string, boolean> } }).route;
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
    send(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  return {
    response,
    getResponse: () => ({ statusCode, body }),
  };
}

function createRequest(options: {
  path: string;
  method: 'GET' | 'POST' | 'PATCH';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  app: express.Express;
}): Request {
  const headers = options.headers ?? {};
  return {
    method: options.method,
    path: options.path,
    body: options.body ?? {},
    params: options.params ?? {},
    app: options.app,
    header: (name: string) =>
      headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? '',
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

test('POST /api/login does not require Authorization and returns token fields', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);

  const login = getRouteHandlers(app, 'post', '/api/login');
  const req = createRequest({
    app,
    method: 'POST',
    path: '/api/login',
    body: { email: 'alice@example.com' },
  });

  const response = await runHandlers(login, req);
  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
  assert.equal((response.body as { token_type?: string }).token_type, 'Bearer');
  assert.equal(
    (response.body as { expires_in_seconds?: number }).expires_in_seconds,
    3600,
  );
  assert.equal((response.body as { user?: JwtUserIdentity }).user?.userId, 'user-1');
  assert.equal(
    typeof (response.body as { token?: unknown }).token,
    'string',
  );
});

test('Protected middleware accepts valid bearer token', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  const login = await runHandlers(
    getRouteHandlers(app, 'post', '/api/login'),
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: { email: 'alice@example.com' },
    }),
  );
  const token = (login.body as { token?: string }).token as string;
  const response = await runHandlers(
    getRouteHandlers(app, 'get', '/api/protected'),
    createRequest({
      app,
      method: 'GET',
      path: '/api/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
  );
  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
});

test('Protected middleware rejects missing Authorization header', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  const response = await runHandlers(
    getRouteHandlers(app, 'get', '/api/protected'),
    createRequest({
      app,
      method: 'GET',
      path: '/api/protected',
    }),
  );
  assert.equal(response.statusCode, 401);
  assert.equal((response.body as { error?: string }).error, 'Not authenticated');
});

test('Protected middleware rejects malformed Authorization header', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  const response = await runHandlers(
    getRouteHandlers(app, 'get', '/api/protected'),
    createRequest({
      app,
      method: 'GET',
      path: '/api/protected',
      headers: {
        authorization: 'Token token-1',
      },
    }),
  );
  assert.equal(response.statusCode, 401);
  assert.equal((response.body as { error?: string }).error, 'Not authenticated');
});

test('Protected middleware rejects invalid token with 401', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  const response = await runHandlers(
    getRouteHandlers(app, 'get', '/api/protected'),
    createRequest({
      app,
      method: 'GET',
      path: '/api/protected',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    }),
  );
  assert.equal(response.statusCode, 401);
  assert.equal((response.body as { error?: string }).error, 'Not authenticated');
});

test('Protected middleware rejects expired token with 401', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);
  app.get('/api/protected', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  const response = await runHandlers(
    getRouteHandlers(app, 'get', '/api/protected'),
    createRequest({
      app,
      method: 'GET',
      path: '/api/protected',
      headers: {
        authorization: 'Bearer expired-token',
      },
    }),
  );
  assert.equal(response.statusCode, 401);
  assert.equal((response.body as { error?: string }).error, 'Not authenticated');
});

test('Protected renew endpoint accepts valid token and returns replacement token', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);

  const loginResponse = await runHandlers(
    getRouteHandlers(app, 'post', '/api/login'),
    createRequest({
      app,
      method: 'POST',
      path: '/api/login',
      body: { email: 'alice@example.com' },
    }),
  );
  const token = (loginResponse.body as { token?: string }).token;

  const response = await runHandlers(
    getRouteHandlers(app, 'post', '/api/renew'),
    createRequest({
      app,
      method: 'POST',
      path: '/api/renew',
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
  );
  assert.equal(response.statusCode, 200);
  assert.equal((response.body as { ok?: boolean }).ok, true);
  assert.equal((response.body as { token_type?: string }).token_type, 'Bearer');
  assert.equal(
    (response.body as { token?: string }).token?.startsWith('token-2'),
    true,
  );
  assert.equal((response.body as { user?: JwtUserIdentity }).user?.userId, 'user-1');
});

test('Protected renew endpoint rejects expired token with 401', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);

  const response = await runHandlers(
    getRouteHandlers(app, 'post', '/api/renew'),
    createRequest({
      app,
      method: 'POST',
      path: '/api/renew',
      headers: {
        authorization: 'Bearer expired-token',
      },
    }),
  );
  assert.equal(response.statusCode, 401);
});

test('Protected renew endpoint rejects invalid token with 401', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService(3600);
  const controller = createAuthController(jwtService);
  controller.register(app);

  const response = await runHandlers(
    getRouteHandlers(app, 'post', '/api/renew'),
    createRequest({
      app,
      method: 'POST',
      path: '/api/renew',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    }),
  );
  assert.equal(response.statusCode, 401);
});
