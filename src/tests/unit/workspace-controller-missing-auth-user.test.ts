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

  async inviteUser() {
    throw new Error('not implemented');
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
