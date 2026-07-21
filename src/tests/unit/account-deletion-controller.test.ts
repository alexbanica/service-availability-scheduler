import assert from 'node:assert/strict';
import express, { NextFunction, Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { AccountController } from '../../controllers/AccountController';

type Result =
  | { status: 'deleted' }
  | { status: 'confirmation_mismatch' }
  | { status: 'user_not_found' }
  | { status: 'owned_workspace_conflict'; error: string };
type HttpResponse = { statusCode: number; body: unknown };
type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | void;

const conflictMessage =
  'Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account.';

class AccountDeletionServiceStub {
  calls: Array<{ userId: string; confirmationEmail: string }> = [];

  constructor(
    private readonly result: Result = { status: 'deleted' },
    private readonly error?: Error,
  ) {}

  async deleteCurrentUser(
    userId: string,
    confirmationEmail: string,
  ): Promise<Result> {
    this.calls.push({ userId, confirmationEmail });
    if (this.error) throw this.error;
    return this.result;
  }
}

function getDeleteHandlers(app: express.Express): RouteHandler[] {
  const layer = (
    app as unknown as { _router: { stack: unknown[] } }
  )._router.stack.find((entry) => {
    const route = (
      entry as { route?: { path?: string; methods?: Record<string, boolean> } }
    ).route;
    return route?.path === '/api/users/me' && route.methods?.delete === true;
  }) as { route: { stack: Array<{ handle: RouteHandler }> } } | undefined;
  assert.ok(layer, 'Route DELETE /api/users/me not found');
  return layer.route.stack.map(({ handle }) => handle);
}

function responseRecorder(): {
  response: Response;
  result: () => HttpResponse;
} {
  let statusCode = 200;
  let body: unknown = null;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
    send(value?: unknown) {
      body = value ?? null;
      return this;
    },
    end() {
      body = null;
      return this;
    },
  } as unknown as Response;
  return { response, result: () => ({ statusCode, body }) };
}

async function invoke(
  service: AccountDeletionServiceStub,
  options: { body?: unknown; user?: unknown } = {},
): Promise<HttpResponse> {
  const app = express();
  new AccountController(service as never).register(app);
  const handlers = getDeleteHandlers(app);
  const request = {
    method: 'DELETE',
    path: '/api/users/me',
    body: options.body,
    authenticatedUser: options.user,
    app,
    header: () => '',
  } as unknown as Request;
  const { response, result } = responseRecorder();
  const next: NextFunction = async (error?: unknown) => {
    if (error) throw error;
  };
  await handlers[1](request, response, next);
  return result();
}

const activatedUser = {
  userId: 'user-1',
  email: 'Alice@Example.com',
  nickname: 'Alice',
  activated: true,
};

test('DELETE /api/users/me returns 204 with no body for an activated user', async () => {
  const service = new AccountDeletionServiceStub();
  const response = await invoke(service, {
    user: activatedUser,
    body: { confirmation_email: ' alice@example.com ' },
  });
  assert.deepEqual(response, { statusCode: 204, body: null });
  assert.deepEqual(service.calls, [
    { userId: 'user-1', confirmationEmail: ' alice@example.com ' },
  ]);
});

test('DELETE /api/users/me is available before activation', async () => {
  const response = await invoke(new AccountDeletionServiceStub(), {
    user: { ...activatedUser, activated: false },
    body: { confirmation_email: 'alice@example.com' },
  });
  assert.equal(response.statusCode, 204);
});

for (const [name, body] of [
  ['absent body', undefined],
  ['null body', null],
  ['array body', []],
  ['malformed non-object body', 'not-an-object'],
  ['missing field', {}],
  ['unknown field', { confirmation_email: 'alice@example.com', extra: true }],
  ['non-string field', { confirmation_email: 42 }],
] as const) {
  test(`DELETE /api/users/me returns 400 for ${name}`, async () => {
    const service = new AccountDeletionServiceStub();
    const response = await invoke(service, { user: activatedUser, body });
    assert.equal(response.statusCode, 400);
    assert.equal(service.calls.length, 0);
  });
}

test('DELETE /api/users/me returns 400 when database email confirmation does not match', async () => {
  const service = new AccountDeletionServiceStub({
    status: 'confirmation_mismatch',
  });
  const response = await invoke(service, {
    user: activatedUser,
    body: { confirmation_email: 'jwt-claim@example.com' },
  });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(service.calls, [
    { userId: 'user-1', confirmationEmail: 'jwt-claim@example.com' },
  ]);
});

test('DELETE /api/users/me returns 401 when authenticated identity is absent', async () => {
  const service = new AccountDeletionServiceStub();
  const response = await invoke(service, {
    body: { confirmation_email: 'alice@example.com' },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(service.calls.length, 0);
});

test('DELETE /api/users/me returns the exact shared-workspace conflict body', async () => {
  const response = await invoke(
    new AccountDeletionServiceStub({
      status: 'owned_workspace_conflict',
      error: conflictMessage,
    }),
    {
      user: activatedUser,
      body: { confirmation_email: 'alice@example.com' },
    },
  );
  assert.deepEqual(response, {
    statusCode: 409,
    body: { error: conflictMessage },
  });
});

test('DELETE /api/users/me maps a missing current user to 401', async () => {
  const response = await invoke(
    new AccountDeletionServiceStub({ status: 'user_not_found' }),
    {
      user: activatedUser,
      body: { confirmation_email: 'alice@example.com' },
    },
  );
  assert.equal(response.statusCode, 401);
});

test('DELETE /api/users/me maps an atomic deletion failure to 500', async () => {
  const response = await invoke(
    new AccountDeletionServiceStub(
      { status: 'deleted' },
      new Error('database failed'),
    ),
    {
      user: activatedUser,
      body: { confirmation_email: 'alice@example.com' },
    },
  );
  assert.equal(response.statusCode, 500);
});
