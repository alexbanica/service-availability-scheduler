import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromRoot = createRequire(process.cwd() + '/');
const buildRoot = path.join(os.tmpdir(), 'sas-browser-tests');

function compileBrowserBundle(): void {
  const result = spawnSync(
    'npx',
    [
      'tsc',
      '-p',
      'tsconfig.client.json',
      '--outDir',
      buildRoot,
      '--module',
      'commonjs',
    ],
    {
      stdio: 'ignore',
    },
  );

  if (result.status !== 0) {
    throw new Error('Failed to compile browser bundle for tests');
  }
  mkdirSync(path.join(buildRoot, 'services'), { recursive: true });
}

compileBrowserBundle();

const { ApiService } = requireFromRoot(
  path.join(buildRoot, 'services/ApiService.js'),
) as {
  ApiService: {
    post: (
      path: string,
      payload?: Record<string, unknown>,
    ) => Promise<Response>;
    get: (path: string) => Promise<Response>;
  };
};

const { LoginService } = requireFromRoot(
  path.join(buildRoot, 'services/LoginService.js'),
) as {
  LoginService: {
    login: (email: string, password: string) => Promise<void>;
  };
};

const { PasswordResetService } = requireFromRoot(
  path.join(buildRoot, 'services/PasswordResetService.js'),
) as {
  PasswordResetService: {
    requestChallenge: () => Promise<{
      challengeId: string;
      challengePrompt: string;
    }>;
    requestPasswordReset: (
      email: string,
      challengeId: string,
      challengeAnswer: string,
    ) => Promise<void>;
    resetPassword: (
      token: string,
      password: string,
      confirmPassword: string,
    ) => Promise<void>;
  };
};

const { AuthService } = requireFromRoot(
  path.join(buildRoot, 'services/AuthService.js'),
) as {
  AuthService: {
    renew: () => Promise<boolean>;
    logout: () => Promise<void>;
    redirectToLoginWhenUnauthenticated: () => boolean;
  };
};

function createMockResponse<T>(status: number, body: T): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  } as Response;
}

type FetchState = {
  url: string;
  headers: Record<string, string>;
  body?: string;
};

function setupFetchMock(resolver: (state: FetchState) => Promise<Response>): {
  restore: () => void;
  state: FetchState[];
} {
  const state: FetchState[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers = (() => {
      const entries = new Headers(init?.headers);
      const all: Record<string, string> = {};
      entries.forEach((value, key) => {
        all[key] = value;
      });
      return all;
    })();
    const fetchState: FetchState = {
      url,
      headers,
      body: init?.body?.toString(),
    };
    state.push(fetchState);
    return resolver(fetchState);
  }) as typeof fetch;

  return {
    state,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function createWindowAndStorage(): {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  hasDocumentClass: (className: string) => boolean;
  getHref: () => string;
  setHref: (nextHref: string) => void;
  restore: () => void;
} {
  const data = new Map<string, string>();
  const classes = new Set<string>();
  let href = '/';

  const localStorage = {
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      data.set(key, value);
    },
    removeItem: (key: string): void => {
      data.delete(key);
    },
    clear: (): void => {
      data.clear();
    },
    key: (): string | null => null,
    length: 0,
  } as Storage;

  const originalStorage = (globalThis as { localStorage?: Storage })
    .localStorage;
  const originalWindow = (
    globalThis as unknown as { window?: { location?: { href: string } } }
  ).window;
  const originalDocument = (
    globalThis as unknown as { document?: { documentElement?: unknown } }
  ).document;

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        get href() {
          return href;
        },
        set href(nextHref: string) {
          href = nextHref;
        },
        replace(nextHref: string) {
          href = nextHref;
        },
      },
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      documentElement: {
        classList: {
          add: (className: string): void => {
            classes.add(className);
          },
          remove: (className: string): void => {
            classes.delete(className);
          },
          contains: (className: string): boolean => classes.has(className),
        },
      },
    },
    configurable: true,
  });

  return {
    get: (key: string) => localStorage.getItem(key),
    set: (key: string, value: string) => localStorage.setItem(key, value),
    remove: (key: string) => localStorage.removeItem(key),
    clear: () => localStorage.clear(),
    hasDocumentClass: (className: string) => classes.has(className),
    getHref: () => href,
    setHref: (nextHref: string) => {
      href = nextHref;
    },
    restore: () => {
      if (originalStorage === undefined) {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      } else {
        Object.defineProperty(globalThis, 'localStorage', {
          value: originalStorage,
          configurable: true,
        });
      }
      if (originalWindow === undefined) {
        delete (globalThis as { window?: object }).window;
      } else {
        Object.defineProperty(globalThis, 'window', {
          value: originalWindow,
          configurable: true,
        });
      }
      if (originalDocument === undefined) {
        delete (globalThis as { document?: object }).document;
      } else {
        Object.defineProperty(globalThis, 'document', {
          value: originalDocument,
          configurable: true,
        });
      }
    },
  };
}

function getHeader(state: FetchState, name: string): string | null {
  return new Headers(state.headers).get(name);
}

test('ApiService does not send Authorization for /api/login', async () => {
  const { set, remove, clear, restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(createMockResponse(200, { ok: true })),
  );

  set('auth_token', 'stored-token');

  await ApiService.post('/api/login', {
    email: 'alice@example.com',
    password: 'secret-password',
  });

  assert.equal(fetch.state.length, 1);
  const tokenHeader = getHeader(fetch.state[0], 'Authorization');
  assert.equal(tokenHeader, null);

  fetch.state.splice(0);
  clear();
  restore();
  fetch.restore();
  remove('auth_token');
});

test('ApiService sends Authorization for non-login calls', async () => {
  const { set, restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(createMockResponse(200, { services: [] })),
  );

  set('auth_token', 'stored-token');

  await ApiService.get('/api/services');

  assert.equal(
    getHeader(fetch.state[0], 'Authorization'),
    'Bearer stored-token',
  );

  fetch.restore();
  restore();
});

test('LoginService stores token returned by /api/login', async () => {
  const { get, clear, restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(
      createMockResponse(200, {
        token: 'issued-token',
        token_type: 'Bearer',
        expires_in_seconds: 3600,
      }),
    ),
  );
  const originalNow = Date.now;
  (Date as { now: () => number }).now = () => 1_000;

  try {
    await LoginService.login('alice@example.com', 'secret-password');
  } finally {
    (Date as { now: () => number }).now = originalNow;
  }

  assert.equal(get('auth_token'), 'issued-token');
  assert.equal(get('auth_token_expires_at_ms'), String(1_000 + 3_600_000));

  fetch.restore();
  clear();
  restore();
});

test('PasswordResetService.requestPasswordReset sends email and captcha payload', async () => {
  const { restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(
      createMockResponse(200, {
        ok: true,
        challenge_id: 'challenge-id',
        challenge_prompt: 'Any?',
      }),
    ),
  );

  await PasswordResetService.requestPasswordReset(
    'alice@example.com',
    'challenge-id',
    'answer',
  );

  const request = fetch.state[0];
  const payload = JSON.parse(request.body ?? '{}');
  assert.equal(payload.email, 'alice@example.com');
  assert.equal(payload.challenge_id, 'challenge-id');
  assert.equal(payload.challenge_answer, 'answer');

  fetch.restore();
  restore();
});

test('PasswordResetService.resetPassword submits token, password, and confirmation', async () => {
  const { restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(
      createMockResponse(200, {
        ok: true,
      }),
    ),
  );

  await PasswordResetService.resetPassword(
    'token-123',
    'new-password',
    'confirm-password',
  );

  const payload = JSON.parse(fetch.state[0]?.body ?? '{}');
  assert.equal(payload.token, 'token-123');
  assert.equal(payload.password, 'new-password');
  assert.equal(payload.confirm_password, 'confirm-password');

  fetch.restore();
  restore();
});

test('ApiService does not send Authorization for unauthenticated reset/captcha endpoints', async () => {
  const { set, clear, remove, restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(createMockResponse(200, { ok: true })),
  );

  set('auth_token', 'stored-token');

  const routes = [
    '/api/password-reset/captcha',
    '/api/password-reset/request',
    '/api/password-reset/validate',
    '/api/password-reset',
  ];

  for (const route of routes) {
    await ApiService.post(route, { value: 'x' });
    assert.equal(
      getHeader(fetch.state[fetch.state.length - 1], 'Authorization'),
      null,
    );
  }

  fetch.restore();
  clear();
  restore();
  remove('auth_token');
});

test('LoginService sends email and password to /api/login', async () => {
  const { restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(
      createMockResponse(200, {
        token: 'issued-token',
        token_type: 'Bearer',
        expires_in_seconds: 3600,
      }),
    ),
  );

  await LoginService.login('alice@example.com', 'secret-password');

  const payload = JSON.parse(fetch.state[0]?.body ?? '{}');
  assert.equal(payload.email, 'alice@example.com');
  assert.equal(payload.password, 'secret-password');

  fetch.restore();
  restore();
});

test('ApiService clears token and redirects on 401', async () => {
  const { set, get, restore, getHref } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(createMockResponse(401, { error: 'Not authenticated' })),
  );

  set('auth_token', 'expired-token');

  await ApiService.get('/api/me');

  assert.equal(get('auth_token'), null);
  assert.equal(getHref(), '/login');

  fetch.restore();
  restore();
});

test('AuthService redirects and hides restored app page without a valid token', () => {
  const { restore, getHref, hasDocumentClass } = createWindowAndStorage();

  const redirected = AuthService.redirectToLoginWhenUnauthenticated();

  assert.equal(redirected, true);
  assert.equal(getHref(), '/login');
  assert.equal(hasDocumentClass('auth-redirecting'), true);

  restore();
});

test('AuthService.logout clears token and redirects even when logout request fails', async () => {
  const { set, get, restore, getHref } = createWindowAndStorage();
  const fetch = setupFetchMock(() => Promise.reject(new Error('network down')));

  set('auth_token', 'stored-token');
  set('auth_token_expires_at_ms', '999999999');

  await assert.rejects(() => AuthService.logout(), /network down/);

  assert.equal(get('auth_token'), null);
  assert.equal(get('auth_token_expires_at_ms'), null);
  assert.equal(getHref(), '/login');

  fetch.restore();
  restore();
});

test('AuthService.renew returns false on non-401 failures and keeps token', async () => {
  const { set, get, restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(createMockResponse(500, { error: 'renew failed' })),
  );

  set('auth_token', 'kept-token');

  const renewed = await AuthService.renew();
  assert.equal(renewed, false);
  assert.equal(get('auth_token'), 'kept-token');

  fetch.restore();
  restore();
});
