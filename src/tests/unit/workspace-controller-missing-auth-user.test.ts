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

class FakeWorkspaceService {
  async listWorkspaces(_userId: string) {
    return [];
  }

  async createWorkspace(_userId: string, _name: string) {
    throw new Error('not implemented');
  }

  async createService(
    _workspaceId: string,
    _userId: string,
    _options: {
      environmentIds: string[];
      environmentNames: string[];
      serviceId: string | null;
      label: string | null;
      defaultMinutes: number;
      ownerId: string | null;
    },
  ) {
    throw new Error('not implemented');
  }

  async updateService(
    _workspaceId: string,
    _userId: string,
    _options: {
      serviceId: string;
      environmentIds: string[];
      environmentNames: string[];
      label: string;
      defaultMinutes: number;
      ownerId: string | null;
    },
  ) {
    return { serviceId: _options.serviceId };
  }

  async deleteService(_workspaceId: string, _userId: string, _serviceId: string) {
    return;
  }

  async listServiceCatalog(_workspaceId: string, _userId: string) {
    return [];
  }

  async listEnvironments(_workspaceId: string, _userId: string) {
    return [];
  }

  async createEnvironment(_workspaceId: string, _userId: string, _payload: { name: string }) {
    throw new Error('not implemented');
  }

  async listOwners(_workspaceId: string, _userId: string) {
    return [];
  }

  async createOwner(_workspaceId: string, _userId: string, _payload: { name: string }) {
    throw new Error('not implemented');
  }

  async listWorkspacePopupRows(
    _workspaceId: string,
    _userId: string,
    _type: 'users' | 'services' | 'owners' | 'environments',
  ) {
    return { items: [] };
  }

  async inviteUser(_workspaceId: string, _userId: string, _inviteeEmail: string) {
    throw new Error('not implemented');
  }
}

test('GET /api/workspaces returns 401 when request-local identity is missing', async () => {
  const app = express();
  const controller = new WorkspaceController(new FakeWorkspaceService() as never);
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
