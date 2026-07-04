import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { EmailJobController } from '../../controllers/EmailJobController';

type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | void;

function getRouteHandlers(app: express.Express): RouteHandler[] {
  const routeLayer = (
    app as unknown as { _router: { stack: unknown[] } }
  )._router.stack.find((layer) => {
    const route = (
      layer as { route?: { path?: string; methods?: Record<string, boolean> } }
    ).route;
    return (
      route?.path === '/api/email-jobs/failed/retry' &&
      route.methods?.post === true
    );
  }) as { route: { stack: Array<{ handle: RouteHandler }> } };
  return routeLayer.route.stack.map((entry) => entry.handle);
}

async function runHandlers(
  handlers: RouteHandler[],
  req: Request,
): Promise<{ statusCode: number; body: unknown }> {
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
  return { statusCode, body };
}

class FakeJwtAuthService {
  async verifyToken(token: string): Promise<{
    userId: string;
    email: string;
    nickname: string;
    activated: boolean;
  }> {
    if (token === 'admin-token') {
      return {
        userId: 'admin-user',
        email: 'admin@example.com',
        nickname: 'Admin',
        activated: true,
      };
    }
    if (token === 'inactive-token') {
      return {
        userId: 'inactive-user',
        email: 'inactive@example.com',
        nickname: 'Inactive',
        activated: false,
      };
    }
    return {
      userId: 'member-user',
      email: 'member@example.com',
      nickname: 'Member',
      activated: true,
    };
  }
}

test('failed-email retry endpoint requires platform admin and forwards filters', async () => {
  const app = express();
  (
    app as unknown as { locals: { jwtAuthService: FakeJwtAuthService } }
  ).locals = { jwtAuthService: new FakeJwtAuthService() };
  const calls: Array<unknown> = [];
  const repository = {
    retryFailedJobs: async (filter: unknown) => {
      calls.push(filter);
      return 2;
    },
  };
  const userRoles = {
    isPlatformAdmin: async (userId: string) => userId === 'admin-user',
  };
  new EmailJobController(repository as never, userRoles as never).register(app);
  const handlers = getRouteHandlers(app);

  const response = await runHandlers(handlers, {
    path: '/api/email-jobs/failed/retry',
    method: 'POST',
    body: {
      email_kind: 'password_reset',
      job_ids: ['job-1', 'job-2'],
    },
    app,
    header: () => 'Bearer admin-token',
  } as unknown as Request);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true, retried: 2 });
  assert.deepEqual(calls, [
    { emailKind: 'password_reset', jobIds: ['job-1', 'job-2'] },
  ]);
});

test('failed-email retry endpoint rejects inactive and non-admin callers', async () => {
  const app = express();
  (
    app as unknown as { locals: { jwtAuthService: FakeJwtAuthService } }
  ).locals = { jwtAuthService: new FakeJwtAuthService() };
  const repository = {
    retryFailedJobs: async () => {
      throw new Error('retry should not run');
    },
  };
  const userRoles = { isPlatformAdmin: async () => false };
  new EmailJobController(repository as never, userRoles as never).register(app);
  const handlers = getRouteHandlers(app);

  const inactive = await runHandlers(handlers, {
    path: '/api/email-jobs/failed/retry',
    method: 'POST',
    body: {},
    app,
    header: () => 'Bearer inactive-token',
  } as unknown as Request);
  assert.equal(inactive.statusCode, 403);
  assert.deepEqual(inactive.body, { error: 'Account not activated' });

  const nonAdmin = await runHandlers(handlers, {
    path: '/api/email-jobs/failed/retry',
    method: 'POST',
    body: {},
    app,
    header: () => 'Bearer member-token',
  } as unknown as Request);
  assert.equal(nonAdmin.statusCode, 403);
  assert.deepEqual(nonAdmin.body, { error: 'Not authorized' });
});
