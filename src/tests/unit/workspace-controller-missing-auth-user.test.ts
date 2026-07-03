import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { WorkspaceController } from '../../controllers/WorkspaceController';

type HttpResponse = {
  statusCode: number;
  body: unknown;
};

type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | void;

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

async function runRouteHandlers(
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
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  return getResponse();
}

function getRouteHandlers(
  app: express.Express,
  method: 'get' | 'post' | 'patch' | 'delete',
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

class FakeWorkspaceService {
  async listWorkspaces() {
    return [];
  }

  async createWorkspace() {
    throw new Error('not implemented');
  }

  async createService() {
    throw new Error('not implemented');
  }

  async updateService(
    workspaceId: string,
    userId: string,
    options: {
      serviceId: string;
      environmentIds: string[];
      environmentNames: string[];
      label: string;
      defaultMinutes: number;
      ownerId: string | null;
    },
  ) {
    void workspaceId;
    void userId;
    return { serviceId: options.serviceId };
  }

  async deleteService() {
    return;
  }

  async listServiceCatalog() {
    return [];
  }

  async listEnvironments() {
    return [];
  }

  async createEnvironment() {
    throw new Error('not implemented');
  }

  async listOwners() {
    return [];
  }

  async createOwner() {
    throw new Error('not implemented');
  }

  async listWorkspacePopupRows() {
    return { items: [] };
  }

  async inviteUser(
    _workspaceId: string,
    _userId: string,
    _email: string,
  ): Promise<{
    workspaceId: string;
    invitationId: string;
    invitedUserId: string | null;
    invitedByUserId: string;
    status: string;
    invitedEmail: string;
    invitationCode: string;
    workspaceName: string;
  }> {
    void _workspaceId;
    void _userId;
    void _email;
    throw new Error('not implemented');
  }
}

class FakeJwtAuthService {
  async verifyToken(token: string): Promise<{
    userId: string;
    email: string;
    nickname: string;
    activated: boolean;
  }> {
    if (token === 'workspace-admin-token') {
      return {
        userId: 'user-admin',
        email: 'admin@example.com',
        nickname: 'Admin',
        activated: true,
      };
    }
    throw new Error('invalid token');
  }
}

class WorkspaceInviteServiceStub extends FakeWorkspaceService {
  public inviteUserCalls: Array<{
    workspaceId: string;
    userId: string;
    email: string;
  }> = [];

  async inviteUser(
    workspaceId: string,
    userId: string,
    email: string,
  ): Promise<{
    workspaceId: string;
    invitationId: string;
    invitedUserId: string | null;
    invitedByUserId: string;
    status: string;
    invitedEmail: string;
    invitationCode: string;
    workspaceName: string;
  }> {
    this.inviteUserCalls.push({ workspaceId, userId, email });
    return {
      workspaceId,
      invitationId: 'invitation-id-1',
      invitedUserId: null,
      invitedByUserId: userId,
      status: 'pending',
      invitedEmail: email,
      invitationCode: 'invite-code-abc',
      workspaceName: 'Operations',
    };
  }
}

test('GET /api/workspaces returns 401 when request-local identity is missing', async () => {
  const app = express();
  const controller = new WorkspaceController(
    new FakeWorkspaceService() as never,
  );
  controller.register(app);

  const handlers = getRouteHandlers(app, 'get', '/api/workspaces');
  const { response, getResponse } = createResponse();
  const req = {
    path: '/api/workspaces',
    method: 'GET',
    body: {},
    params: {},
    header: () => '',
  } as unknown as Request;

  await handlers[1](req, response, (() => {}) as NextFunction);

  const result = getResponse();
  assert.equal(result.statusCode, 401);
  assert.equal((result.body as { error?: string }).error, 'Not authenticated');
});

test('workspace routes return 401 when request-local identity is missing', async () => {
  const app = express();
  const controller = new WorkspaceController(
    new FakeWorkspaceService() as never,
  );
  controller.register(app);

  const routeCases: Array<{
    method: 'get' | 'post' | 'patch' | 'delete';
    path: string;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
  }> = [
    {
      method: 'get',
      path: '/api/workspaces',
    },
    {
      method: 'post',
      path: '/api/workspaces',
      body: { name: 'Workspace' },
    },
    {
      method: 'post',
      path: '/api/workspaces/:workspaceId/services',
      params: { workspaceId: 'workspace-1' },
      body: {
        environment_names: ['Dev'],
        label: 'Service',
        default_minutes: 15,
      },
    },
    {
      method: 'get',
      path: '/api/workspaces/:workspaceId/services',
      params: { workspaceId: 'workspace-1' },
    },
    {
      method: 'patch',
      path: '/api/workspaces/:workspaceId/services/:serviceId',
      params: { workspaceId: 'workspace-1', serviceId: 'service-1' },
      body: {
        environment_names: ['Dev'],
        label: 'Service',
        default_minutes: 15,
      },
    },
    {
      method: 'delete',
      path: '/api/workspaces/:workspaceId/services/:serviceId',
      params: { workspaceId: 'workspace-1', serviceId: 'service-1' },
    },
    {
      method: 'get',
      path: '/api/workspaces/:workspaceId/environments',
      params: { workspaceId: 'workspace-1' },
    },
    {
      method: 'post',
      path: '/api/workspaces/:workspaceId/environments',
      params: { workspaceId: 'workspace-1' },
      body: { name: 'Environment' },
    },
    {
      method: 'get',
      path: '/api/workspaces/:workspaceId/owners',
      params: { workspaceId: 'workspace-1' },
    },
    {
      method: 'post',
      path: '/api/workspaces/:workspaceId/owners',
      params: { workspaceId: 'workspace-1' },
      body: { name: 'Owner' },
    },
    {
      method: 'delete',
      path: '/api/workspaces/:workspaceId/owners/:ownerId',
      params: {
        workspaceId: 'workspace-1',
        ownerId: 'owner-1',
      },
    },
    {
      method: 'delete',
      path: '/api/workspaces/:workspaceId/environments/:environmentId',
      params: {
        workspaceId: 'workspace-1',
        environmentId: 'environment-1',
      },
    },
    {
      method: 'get',
      path: '/api/workspaces/:workspaceId/detail/users',
      params: { workspaceId: 'workspace-1' },
    },
    {
      method: 'get',
      path: '/api/workspaces/:workspaceId/detail/services',
      params: { workspaceId: 'workspace-1' },
    },
    {
      method: 'get',
      path: '/api/workspaces/:workspaceId/detail/owners',
      params: { workspaceId: 'workspace-1' },
    },
    {
      method: 'get',
      path: '/api/workspaces/:workspaceId/detail/environments',
      params: { workspaceId: 'workspace-1' },
    },
    {
      method: 'post',
      path: '/api/workspaces/:workspaceId/invitations',
      params: { workspaceId: 'workspace-1' },
      body: { email: 'invitee@example.com' },
    },
    {
      method: 'post',
      path: '/api/workspace-invitations/:code/accept',
      params: { code: 'invite-code' },
    },
    {
      method: 'patch',
      path: '/api/workspaces/:workspaceId/users/:userId/role',
      params: {
        workspaceId: 'workspace-1',
        userId: 'user-2',
      },
      body: { role: 'manager' },
    },
    {
      method: 'delete',
      path: '/api/workspaces/:workspaceId/users/:userId',
      params: {
        workspaceId: 'workspace-1',
        userId: 'user-2',
      },
    },
  ];

  for (const route of routeCases) {
    const handlers = getRouteHandlers(app, route.method, route.path);
    const { response, getResponse } = createResponse();
    const req = {
      path: route.path,
      method: route.method.toUpperCase(),
      body: route.body ?? {},
      params: route.params ?? {},
      header: () => '',
    } as unknown as Request;

    const last = handlers[handlers.length - 1];
    await last(req, response, (() => {}) as NextFunction);

    const result = getResponse();
    assert.equal(
      result.statusCode,
      401,
      `Expected 401 for ${route.method.toUpperCase()} ${route.path}`,
    );
    assert.equal(
      (result.body as { error?: string }).error,
      'Not authenticated',
    );
  }
});

test('POST /api/workspaces/:workspaceId/invitations does not log raw invitation links', async () => {
  const app = express();
  const workspaceService = new WorkspaceInviteServiceStub();
  const controller = new WorkspaceController(workspaceService as never);
  (
    app as unknown as { locals: { jwtAuthService: FakeJwtAuthService } }
  ).locals = { jwtAuthService: new FakeJwtAuthService() };
  controller.register(app);

  const originalConsoleInfo = console.info;
  const infoMessages: Array<string> = [];
  console.info = (message: string, ...params: Array<unknown>) => {
    infoMessages.push([message, ...params].map(String).join(' '));
  };

  try {
    const route = getRouteHandlers(
      app,
      'post',
      '/api/workspaces/:workspaceId/invitations',
    );
    const response = await runRouteHandlers(route, {
      path: '/api/workspaces/workspace-1/invitations',
      method: 'POST',
      body: { email: 'new-user@example.com' },
      params: { workspaceId: 'workspace-1' },
      app,
      header: (name: string) =>
        name.toLowerCase() === 'authorization'
          ? 'Bearer workspace-admin-token'
          : '',
    } as unknown as Request);

    assert.equal(response.statusCode, 201, JSON.stringify(response.body));
    assert.equal(
      workspaceService.inviteUserCalls[0]?.workspaceId,
      'workspace-1',
      'Expected invite to target the requested workspace',
    );
    assert.equal(
      workspaceService.inviteUserCalls[0]?.userId,
      'user-admin',
      'Expected request to use authenticated user as inviter',
    );
    assert.equal(
      workspaceService.inviteUserCalls[0]?.email,
      'new-user@example.com',
    );

    const responseBody = response.body as Record<string, unknown>;
    assert.equal(
      Object.prototype.hasOwnProperty.call(responseBody, 'invitation_code'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(responseBody, 'invitation_url'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(responseBody, 'invitation_link'),
      false,
    );
    assert.equal(
      infoMessages.some((entry) =>
        entry.includes('/workspace-invitations/invite-code-abc'),
      ),
      false,
    );
    assert.equal(
      infoMessages.some((entry) => entry.includes('TODO')),
      false,
    );
  } finally {
    console.info = originalConsoleInfo;
  }
});
