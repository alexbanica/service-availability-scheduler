import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { ReservationController } from '../../controllers/ReservationController';
import { ServiceController } from '../../controllers/ServiceController';
import { WorkspaceController } from '../../controllers/WorkspaceController';
import { assignJwtAuthService } from '../../controllers/AuthMiddleware';

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

class FakeReservationService {
  async getServiceList() {
    return {
      expiryWarningMinutes: 15,
      autoRefreshSeconds: 60,
      services: [],
    };
  }

  async claim() {
    return new Date();
  }

  async release() {
    return;
  }

  async extend() {
    return new Date();
  }

  async listExpiring() {
    return [];
  }
}

class FakeWorkspaceService {
  async listWorkspaces() {
    return [];
  }

  async createWorkspace() {
    throw new Error('not required for this test');
  }

  async createService() {
    throw new Error('not required for this test');
  }

  async updateService() {
    throw new Error('not required for this test');
  }

  async deleteService() {
    throw new Error('not required for this test');
  }

  async listServiceCatalog() {
    return [];
  }

  async listEnvironments() {
    return [];
  }

  async createEnvironment() {
    throw new Error('not required for this test');
  }

  async listOwners() {
    return [];
  }

  async createOwner() {
    throw new Error('not required for this test');
  }

  async listWorkspacePopupRows() {
    return [];
  }

  async inviteUser() {
    throw new Error('not required for this test');
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
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
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

async function makeActivatedToken(
  jwtService: FakeJwtAuthService,
  activated: boolean,
): Promise<string> {
  return jwtService.issueToken({
    userId: 'user-1',
    email: 'alice@example.com',
    nickname: 'Alice',
    activated,
  });
}

test('GET /api/services requires activated identity', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService();
  assignJwtAuthService(app, jwtService as unknown as never);

  new ServiceController(new FakeReservationService() as never).register(app);

  const route = getRouteHandlers(app, 'get', '/api/services');
  const token = await makeActivatedToken(jwtService, false);
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'GET',
      path: '/api/services',
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(
    (response.body as { error?: string }).error,
    'Account not activated',
  );
});

test('POST /api/claim requires activated identity', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService();
  assignJwtAuthService(app, jwtService as unknown as never);

  new ReservationController(new FakeReservationService() as never).register(
    app,
  );

  const route = getRouteHandlers(app, 'post', '/api/claim');
  const token = await makeActivatedToken(jwtService, false);
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/claim',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        service_key: 'service-1',
      },
    }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(
    (response.body as { error?: string }).error,
    'Account not activated',
  );
});

test('POST /api/workspaces requires activated identity', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService();
  assignJwtAuthService(app, jwtService as unknown as never);

  new WorkspaceController(new FakeWorkspaceService() as never).register(app);

  const route = getRouteHandlers(app, 'post', '/api/workspaces');
  const token = await makeActivatedToken(jwtService, false);
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'POST',
      path: '/api/workspaces',
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: {
        name: 'My Workspace',
      },
    }),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(
    (response.body as { error?: string }).error,
    'Account not activated',
  );
});

test('GET /api/workspaces allows non-activated authenticated users to read memberships', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService();
  assignJwtAuthService(app, jwtService as unknown as never);

  new WorkspaceController(new FakeWorkspaceService() as never).register(app);

  const route = getRouteHandlers(app, 'get', '/api/workspaces');
  const token = await makeActivatedToken(jwtService, false);
  const response = await runHandlers(
    route,
    createRequest({
      app,
      method: 'GET',
      path: '/api/workspaces',
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    (response.body as { workspaces?: unknown[] }).workspaces,
    [],
  );
});

test('GET /api/workspace detail popup routes require activated identity', async () => {
  const app = express();
  app.use(express.json());
  const jwtService = new FakeJwtAuthService();
  assignJwtAuthService(app, jwtService as unknown as never);

  new WorkspaceController(new FakeWorkspaceService() as never).register(app);

  const token = await makeActivatedToken(jwtService, false);
  const detailRoutes = [
    '/api/workspaces/:workspaceId/detail/users',
    '/api/workspaces/:workspaceId/detail/services',
    '/api/workspaces/:workspaceId/detail/owners',
    '/api/workspaces/:workspaceId/detail/environments',
  ];

  for (const routePath of detailRoutes) {
    const route = getRouteHandlers(app, 'get', routePath);
    const response = await runHandlers(
      route,
      createRequest({
        app,
        method: 'GET',
        path: routePath,
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    );

    assert.equal(response.statusCode, 403, routePath);
    assert.equal(
      (response.body as { error?: string }).error,
      'Account not activated',
    );
  }
});
