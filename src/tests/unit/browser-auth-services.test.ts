import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromRoot = createRequire(process.cwd() + '/');
const buildRoot = path.join(os.tmpdir(), 'sas-browser-auth-services-tests');

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
    isAuthenticated: () => boolean;
    loadUser: () => Promise<AppUserStub | null>;
    renew: () => Promise<boolean>;
    logout: () => Promise<void>;
    redirectToLoginWhenUnauthenticated: () => boolean;
  };
};

type ChallengePayload = {
  challengeId: string;
  challengePrompt: string;
};

type RegistrationPayload = {
  email: string;
  nickname: string;
  password: string;
  confirm_password: string;
  challenge_id: string;
  challenge_answer: string;
};

type ActivationPayload = {
  token: string;
};

function loadBuildService<T>(
  modulePath: string,
  exportName: string,
): { module: T | null } {
  try {
    const loaded = requireFromRoot(modulePath) as Record<string, unknown>;
    const value = loaded[exportName];
    if (typeof value === 'function') {
      return { module: value as T };
    }
    return { module: null };
  } catch {
    return { module: null };
  }
}

const RegistrationService = loadBuildService<{
  requestChallenge: () => Promise<ChallengePayload>;
  register: (payload: RegistrationPayload) => Promise<void>;
}>(
  path.join(buildRoot, 'services/RegistrationService.js'),
  'RegistrationService',
).module;

const AccountActivationService = loadBuildService<{
  validate: (payload: ActivationPayload) => Promise<boolean>;
  activate: (payload: ActivationPayload) => Promise<void>;
  validateActivationToken?: (payload: ActivationPayload) => Promise<boolean>;
  activateAccount?: (payload: ActivationPayload) => Promise<void>;
}>(
  path.join(buildRoot, 'services/AccountActivationService.js'),
  'AccountActivationService',
).module;

const LoginController = loadBuildService<{
  new (): {
    bootstrap: (Vue: unknown) => void;
  };
}>(
  path.join(buildRoot, 'controllers/LoginController.js'),
  'LoginController',
).module;

const AppController = loadBuildService<{
  new (): {
    bootstrap: (Vue: unknown) => void;
  };
}>(
  path.join(buildRoot, 'controllers/AppController.js'),
  'AppController',
).module;

const WorkspaceInvitationController = loadBuildService<{
  new (): {
    bootstrap: (Vue: unknown) => void;
  };
}>(
  path.join(buildRoot, 'controllers/WorkspaceInvitationController.js'),
  'WorkspaceInvitationController',
).module;

const WorkspaceService = loadBuildService<{
  validateInvitation: (code: string) => Promise<{
    status: string;
    existingUserInvite: boolean;
    invitation: {
      workspaceId: string;
      invitedUserId: string | null;
      invitedByUserId: string;
      invitedEmail: string;
      expiresAt: string;
    } | null;
  }>;
  acceptInvitation: (code: string) => Promise<void>;
}>(
  path.join(buildRoot, 'services/WorkspaceService.js'),
  'WorkspaceService',
).module;

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

type Ref<T> = { value: T };

type LoginControllerState = {
  email: Ref<string>;
  password: Ref<string>;
  mode: Ref<'login' | 'register' | 'forgot'>;
  isLoginMode: Ref<boolean>;
  isForgotMode: Ref<boolean>;
  isRegisterModeComputed: Ref<boolean>;
  forgotEmail: Ref<string>;
  forgotChallengeId: Ref<string>;
  forgotChallengePrompt: Ref<string>;
  forgotChallengeAnswer: Ref<string>;
  forgotRequestError: Ref<string>;
  forgotRequestSuccess: Ref<boolean>;
  registerEmail: Ref<string>;
  registerChallengeId: Ref<string>;
  registerChallengePrompt: Ref<string>;
  registerChallengeAnswer: Ref<string>;
  registerRequestError: Ref<string>;
  registerRequestSuccess: Ref<boolean>;
  submit: () => Promise<void>;
  openLoginMode: () => void;
  openForgotMode: () => void;
  openRegisterMode: () => void;
  loadResetChallenge: () => Promise<void>;
  resetForgotChallenge: () => void;
  loadRegisterChallenge: () => Promise<void>;
  resetRegisterChallenge: () => void;
};

type AppView = 'overview' | 'availability' | 'admin';

type AppUserStub = {
  id: string;
  email: string;
  nickname: string;
  activated: boolean;
};

type WorkspaceSummaryStub = {
  id: string;
  currentUserRole: 'admin' | 'manager' | 'member';
};

type AppControllerState = {
  currentView: Ref<AppView>;
  setView: (view: AppView) => void;
  user: Ref<AppUserStub | null>;
  toastMessage: Ref<string>;
  workspaces: Ref<WorkspaceSummaryStub[]>;
  canAccessAdministration: Ref<boolean>;
  resourceAdminWorkspaces: Ref<WorkspaceSummaryStub[]>;
  isCreateWorkspaceModalOpen: Ref<boolean>;
  isCreateServiceModalOpen: Ref<boolean>;
  isInviteModalOpen: Ref<boolean>;
  ownerModalWorkspaceId: Ref<string | null>;
  environmentModalWorkspaceId: Ref<string | null>;
  claimModalOpen: Ref<boolean>;
  openCreateWorkspaceModal: () => void;
  openCreateServiceModal: () => void;
  openInviteModal: (workspaceId: string) => void;
  openOwnerModal: (workspaceId: string) => void;
  openEnvironmentModal: (workspaceId: string) => void;
  openClaimModal: (serviceKey: string) => void;
  consumePendingWorkspaceInvitation: () => Promise<void>;
};

type WorkspaceInvitationControllerState = {
  loading: Ref<boolean>;
  error: Ref<string>;
  status: Ref<string>;
  invitedEmail: Ref<string>;
  isValidExistingInvite: Ref<boolean>;
  isUnregisteredInvite: Ref<boolean>;
  accepted: Ref<boolean>;
};

function createLoginControllerState(): LoginControllerState {
  if (!LoginController) {
    assert.fail('LoginController is not available in browser bundle');
  }

  let state: LoginControllerState | null = null;
  const mountedCallbacks: Array<() => void | Promise<void>> = [];
  const fakeVue = {
    createApp: (options: { setup: () => LoginControllerState }) => {
      state = options.setup();
      return {
        mount: () => {
          return;
        },
      };
    },
    ref: <T>(value: T): Ref<T> => ({ value }),
    computed: <T>(fn: () => T) => ({
      get value() {
        return fn();
      },
    }),
    onMounted: (callback: () => void | Promise<void>) => {
      mountedCallbacks.push(callback);
    },
  };

  new LoginController().bootstrap(fakeVue);

  if (!state) {
    assert.fail('LoginController did not expose setup state');
  }

  mountedCallbacks.forEach((callback) => {
    void callback();
  });

  return state;
}

async function createWorkspaceInvitationControllerState(): Promise<WorkspaceInvitationControllerState> {
  if (!WorkspaceInvitationController) {
    assert.fail(
      'WorkspaceInvitationController is not available in browser bundle',
    );
  }

  let state: WorkspaceInvitationControllerState | null = null;
  const mountedCallbacks: Array<() => void | Promise<void>> = [];
  const fakeVue = {
    createApp: (options: {
      setup: () => WorkspaceInvitationControllerState;
    }) => {
      state = options.setup();
      return {
        mount: () => {
          return;
        },
      };
    },
    ref: <T>(value: T): Ref<T> => ({ value }),
    computed: <T>(fn: () => T) => ({
      get value() {
        return fn();
      },
    }),
    onMounted: (callback: () => void | Promise<void>) => {
      mountedCallbacks.push(callback);
    },
  };

  new WorkspaceInvitationController().bootstrap(fakeVue);

  if (!state) {
    assert.fail('WorkspaceInvitationController did not expose setup state');
  }

  for (const callback of mountedCallbacks) {
    await callback();
  }

  return state;
}

function createAppControllerState(): AppControllerState {
  if (!AppController) {
    assert.fail('AppController is not available in browser bundle');
  }

  let state: AppControllerState | null = null;
  const fakeVue = {
    createApp: (options: { setup: () => AppControllerState }) => {
      state = options.setup();
      return {
        mount: () => {
          return;
        },
      };
    },
    ref: <T>(value: T): Ref<T> => ({ value }),
    computed: <T>(fn: () => T) => ({
      get value() {
        return fn();
      },
    }),
    onMounted: () => {
      return;
    },
    watch: () => {
      return;
    },
  };

  new AppController().bootstrap(fakeVue);

  if (!state) {
    assert.fail('AppController did not expose setup state');
  }

  return state;
}

function createWindowAndStorage(): {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  setSession: (key: string, value: string) => void;
  getSession: (key: string) => string | null;
  remove: (key: string) => void;
  clear: () => void;
  hasDocumentClass: (className: string) => boolean;
  getHref: () => string;
  setHref: (nextHref: string) => void;
  restore: () => void;
} {
  const data = new Map<string, string>();
  const sessionData = new Map<string, string>();
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
        get pathname() {
          return new URL(href, 'http://localhost').pathname;
        },
        get search() {
          return new URL(href, 'http://localhost').search;
        },
        replace(nextHref: string) {
          href = nextHref;
        },
        assign(nextHref: string) {
          href = nextHref;
        },
      },
      history: {
        pushState: (_state: object, _unused: string, nextHref: string) => {
          href = nextHref;
        },
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      sessionStorage: {
        getItem: (key: string): string | null => sessionData.get(key) ?? null,
        setItem: (key: string, value: string): void => {
          sessionData.set(key, value);
        },
        removeItem: (key: string): void => {
          sessionData.delete(key);
        },
      },
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      documentElement: {
        dataset: {},
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
    setSession: (key: string, value: string) => {
      sessionData.set(key, value);
    },
    getSession: (key: string) => sessionData.get(key) ?? null,
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

test('ApiService does not send Authorization for registration and activation unauthenticated endpoints', async () => {
  const { set, clear, remove, restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(createMockResponse(200, { ok: true })),
  );

  set('auth_token', 'stored-token');

  const routes = [
    '/api/register/captcha',
    '/api/register',
    '/api/account-activation/validate',
    '/api/account-activation',
  ];

  for (const route of routes) {
    await ApiService.post(route, { token: 'sample' });
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

test('RegistrationService requests challenge and registration payload through unauthenticated endpoints', async () => {
  if (!RegistrationService) {
    assert.fail('RegistrationService is not available in browser bundle');
  }

  const { get, restore } = createWindowAndStorage();
  const request = setupFetchMock(() =>
    Promise.resolve(
      createMockResponse(200, {
        challenge_id: 'register-challenge-id',
        challenge_prompt: 'What is your favorite color?',
        ok: true,
      }),
    ),
  );

  const challenge = await RegistrationService.requestChallenge();
  assert.equal(challenge.challengeId, 'register-challenge-id');
  assert.equal(challenge.challengePrompt, 'What is your favorite color?');
  assert.equal(
    getHeader(request.state[request.state.length - 1], 'Authorization'),
    null,
  );

  const registrationPayload = {
    email: 'alice@example.com',
    nickname: 'Alice',
    password: 'password123',
    confirm_password: 'password123',
    challenge_id: 'register-challenge-id',
    challenge_answer: 'blue',
  };

  request.restore();
  const register = setupFetchMock(() =>
    Promise.resolve(
      createMockResponse(200, {
        ok: true,
        token: 'registered-token',
        token_type: 'Bearer',
        expires_in_seconds: 900,
      }),
    ),
  );
  await RegistrationService.register(registrationPayload);

  const registerBody = JSON.parse(
    register.state.at(-1)?.body ?? '{}',
  ) as Record<string, string>;
  assert.equal(registerBody.email, registrationPayload.email);
  assert.equal(registerBody.nickname, registrationPayload.nickname);
  assert.equal(registerBody.password, registrationPayload.password);
  assert.equal(
    registerBody.confirm_password,
    registrationPayload.confirm_password,
  );
  assert.equal(registerBody.challenge_id, registrationPayload.challenge_id);
  assert.equal(
    registerBody.challenge_answer,
    registrationPayload.challenge_answer,
  );
  assert.equal(
    getHeader(register.state[register.state.length - 1], 'Authorization'),
    null,
  );
  assert.equal(get('auth_token'), 'registered-token');
  assert.ok(get('auth_token_expires_at_ms'));

  register.restore();
  restore();
});

test('LoginController resets loaded registration captcha when registration fields change', async () => {
  if (!RegistrationService) {
    assert.fail('RegistrationService is not available in browser bundle');
  }

  const { restore } = createWindowAndStorage();
  const originalRequestChallenge = RegistrationService.requestChallenge;
  RegistrationService.requestChallenge = async () => ({
    challengeId: 'register-challenge-id',
    challengePrompt: '1 + 1?',
  });

  try {
    const state = createLoginControllerState();

    state.openRegisterMode();
    await state.loadRegisterChallenge();

    assert.equal(state.registerChallengeId.value, 'register-challenge-id');
    assert.equal(state.registerChallengePrompt.value, '1 + 1?');

    state.registerRequestError.value = 'Passwords do not match';
    state.registerRequestSuccess.value = true;
    state.registerChallengeAnswer.value = '2';
    state.registerEmail.value = 'updated@example.com';
    state.resetRegisterChallenge();

    assert.equal(state.registerChallengeId.value, '');
    assert.equal(state.registerChallengePrompt.value, '');
    assert.equal(state.registerChallengeAnswer.value, '');
    assert.equal(state.registerRequestError.value, '');
    assert.equal(state.registerRequestSuccess.value, false);
  } finally {
    RegistrationService.requestChallenge = originalRequestChallenge;
    restore();
  }
});

test('LoginController opens registration mode when served from /register', () => {
  const { restore, setHref } = createWindowAndStorage();
  try {
    setHref('/register');
    const state = createLoginControllerState();

    assert.equal(state.mode.value, 'register');
    assert.equal(state.isRegisterModeComputed.value, true);
    assert.equal(state.isLoginMode.value, false);
  } finally {
    restore();
  }
});

test('LoginController keeps registration mode under /register path', () => {
  const { restore, getHref } = createWindowAndStorage();
  try {
    const state = createLoginControllerState();

    state.openRegisterMode();

    assert.equal(getHref(), '/register');
    assert.equal(state.isRegisterModeComputed.value, true);

    state.openLoginMode();

    assert.equal(getHref(), '/login');
    assert.equal(state.isLoginMode.value, true);
  } finally {
    restore();
  }
});

test('LoginController redirects to overview after clicked invitation login handoff', async () => {
  const { setHref, getHref, setSession, getSession, restore } =
    createWindowAndStorage();
  const originalLogin = LoginService.login;
  LoginService.login = async () => {
    return;
  };

  try {
    setSession('workspace_invitation_login_code', 'invite-123');
    setHref('/login?invitation_handoff=1');
    const state = createLoginControllerState();
    state.email.value = 'alice@example.com';
    state.password.value = 'secret-password';

    await state.submit();

    assert.equal(getHref(), '/overview');
    assert.equal(
      getSession('workspace_invitation_pending_accept_code'),
      'invite-123',
    );
  } finally {
    LoginService.login = originalLogin;
    restore();
  }
});

test('LoginController redirects to overview when normal login has stale invitation state', async () => {
  const { setHref, getHref, setSession, restore } = createWindowAndStorage();
  const originalLogin = LoginService.login;
  LoginService.login = async () => {
    return;
  };

  try {
    setSession('workspace_invitation_login_code', 'stale-invite');
    setHref('/login');
    const state = createLoginControllerState();
    state.email.value = 'alice@example.com';
    state.password.value = 'secret-password';

    await state.submit();

    assert.equal(getHref(), '/overview');
  } finally {
    LoginService.login = originalLogin;
    restore();
  }
});

test('LoginController treats invitation_code query as registration context only', async () => {
  const { setHref, getHref, restore } = createWindowAndStorage();
  const originalLogin = LoginService.login;
  LoginService.login = async () => {
    return;
  };

  try {
    setHref('/login?invitation_code=registration-invite');
    const state = createLoginControllerState();
    assert.equal(state.mode.value, 'register');

    state.email.value = 'alice@example.com';
    state.password.value = 'secret-password';
    await state.submit();

    assert.equal(getHref(), '/overview');
  } finally {
    LoginService.login = originalLogin;
    restore();
  }
});

test('AppController opens the view that matches the authenticated app path', () => {
  const { restore, setHref } = createWindowAndStorage();
  try {
    setHref('/services');
    assert.equal(createAppControllerState().currentView.value, 'availability');

    setHref('/administration');
    assert.equal(createAppControllerState().currentView.value, 'admin');

    setHref('/overview');
    assert.equal(createAppControllerState().currentView.value, 'overview');
  } finally {
    restore();
  }
});

test('AppController keeps non-activated users in read-only mode but preserves admin workspace visibility', async () => {
  const { restore } = createWindowAndStorage();

  try {
    const state = createAppControllerState();

    state.user.value = {
      id: 'user-1',
      email: 'invited@example.com',
      nickname: 'Invited User',
      activated: false,
    };

    state.workspaces.value = [
      {
        id: 'workspace-admin',
        currentUserRole: 'admin',
      },
      {
        id: 'workspace-manager',
        currentUserRole: 'manager',
      },
      {
        id: 'workspace-member',
        currentUserRole: 'member',
      },
    ];

    assert.equal(state.canAccessAdministration.value, true);
    assert.equal(state.resourceAdminWorkspaces.value.length, 2);

    state.openCreateWorkspaceModal();
    assert.equal(state.isCreateWorkspaceModalOpen.value, false);

    state.openCreateServiceModal();
    assert.equal(state.isCreateServiceModalOpen.value, false);

    state.openInviteModal('workspace-admin');
    assert.equal(state.isInviteModalOpen.value, false);

    state.openOwnerModal('workspace-admin');
    assert.equal(state.ownerModalWorkspaceId.value, null);

    state.openEnvironmentModal('workspace-admin');
    assert.equal(state.environmentModalWorkspaceId.value, null);

    state.openClaimModal('service-key');
    assert.equal(state.claimModalOpen.value, false);
  } finally {
    restore();
  }
});

test('AppController refuses pending invitation handoff for another authenticated email', async () => {
  if (!WorkspaceService) {
    assert.fail('WorkspaceService is not available in browser bundle');
  }

  const originalValidateInvitation = WorkspaceService.validateInvitation;
  const originalAcceptInvitation = WorkspaceService.acceptInvitation;
  let accepted = false;
  WorkspaceService.validateInvitation = async (code: string) => {
    assert.equal(code, 'invite-123');
    return {
      status: 'valid',
      existingUserInvite: true,
      invitation: {
        workspaceId: 'workspace-1',
        invitedUserId: 'invited-user',
        invitedByUserId: 'admin-user',
        invitedEmail: ' invited@example.com ',
        expiresAt: '2026-07-02T00:00:00.000Z',
      },
    };
  };
  WorkspaceService.acceptInvitation = async () => {
    accepted = true;
  };

  const { restore, setSession, getSession } = createWindowAndStorage();
  try {
    const state = createAppControllerState();
    state.user.value = {
      id: 'other-user',
      email: 'other@example.com',
      nickname: 'Other User',
      activated: true,
    };
    setSession('workspace_invitation_pending_accept_code', 'invite-123');

    await state.consumePendingWorkspaceInvitation();

    assert.equal(accepted, false);
    assert.equal(
      state.toastMessage.value,
      'This invitation belongs to another account.',
    );
    assert.equal(getSession('workspace_invitation_pending_accept_code'), null);
  } finally {
    WorkspaceService.validateInvitation = originalValidateInvitation;
    WorkspaceService.acceptInvitation = originalAcceptInvitation;
    restore();
  }
});

test('WorkspaceInvitationController refuses unregistered invitation while authenticated', async () => {
  if (!WorkspaceService) {
    assert.fail('WorkspaceService is not available in browser bundle');
  }

  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalLoadUser = AuthService.loadUser;
  const originalValidateInvitation = WorkspaceService.validateInvitation;
  const originalAcceptInvitation = WorkspaceService.acceptInvitation;
  let accepted = false;
  AuthService.isAuthenticated = () => true;
  AuthService.loadUser = async () => ({
    id: 'existing-user',
    email: 'existing@example.com',
    nickname: 'Existing User',
    activated: true,
  });
  WorkspaceService.validateInvitation = async (code: string) => {
    assert.equal(code, 'invite-456');
    return {
      status: 'unregistered',
      existingUserInvite: false,
      invitation: {
        workspaceId: 'workspace-1',
        invitedUserId: null,
        invitedByUserId: 'admin-user',
        invitedEmail: 'new-person@example.com',
        expiresAt: '2026-07-02T00:00:00.000Z',
      },
    };
  };
  WorkspaceService.acceptInvitation = async () => {
    accepted = true;
  };

  const { restore, setHref } = createWindowAndStorage();
  const fetch = setupFetchMock(async () =>
    createMockResponse(200, { version: 'test' }),
  );
  try {
    setHref('/workspace-invitations/invite-456');

    const state = await createWorkspaceInvitationControllerState();

    assert.equal(accepted, false);
    assert.equal(
      state.error.value,
      'This invitation belongs to another account.',
    );
    assert.equal(state.isUnregisteredInvite.value, false);
    assert.equal(state.isValidExistingInvite.value, false);
  } finally {
    AuthService.isAuthenticated = originalIsAuthenticated;
    AuthService.loadUser = originalLoadUser;
    WorkspaceService.validateInvitation = originalValidateInvitation;
    WorkspaceService.acceptInvitation = originalAcceptInvitation;
    fetch.restore();
    restore();
  }
});

test('WorkspaceInvitationController allows unregistered invitation when no current user loads', async () => {
  if (!WorkspaceService) {
    assert.fail('WorkspaceService is not available in browser bundle');
  }

  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalLoadUser = AuthService.loadUser;
  const originalValidateInvitation = WorkspaceService.validateInvitation;
  AuthService.isAuthenticated = () => true;
  AuthService.loadUser = async () => null;
  WorkspaceService.validateInvitation = async (code: string) => {
    assert.equal(code, 'invite-789');
    return {
      status: 'unregistered',
      existingUserInvite: false,
      invitation: {
        workspaceId: 'workspace-1',
        invitedUserId: null,
        invitedByUserId: 'admin-user',
        invitedEmail: 'new-person@example.com',
        expiresAt: '2026-07-02T00:00:00.000Z',
      },
    };
  };

  const { restore, setHref } = createWindowAndStorage();
  const fetch = setupFetchMock(async () =>
    createMockResponse(200, { version: 'test' }),
  );
  try {
    setHref('/workspace-invitations/invite-789');

    const state = await createWorkspaceInvitationControllerState();

    assert.equal(state.error.value, '');
    assert.equal(state.isUnregisteredInvite.value, true);
    assert.equal(state.invitedEmail.value, 'new-person@example.com');
  } finally {
    AuthService.isAuthenticated = originalIsAuthenticated;
    AuthService.loadUser = originalLoadUser;
    WorkspaceService.validateInvitation = originalValidateInvitation;
    fetch.restore();
    restore();
  }
});

test('Workspace user role editor does not offer admin promotion', () => {
  const indexHtml = readFileSync(
    path.join(process.cwd(), 'public/index.html'),
    'utf8',
  );
  const roleEditorMatch = indexHtml.match(
    /<div class="role-selector"[\s\S]*?<\/div>/,
  );
  assert.ok(roleEditorMatch, 'workspace user role editor not found');
  const roleEditorHtml = roleEditorMatch[0];

  assert.equal(
    /updateWorkspaceUserRole\(workspaceUser, 'admin'\)/i.test(roleEditorHtml),
    false,
    'found an admin role action in workspace user role editor',
  );
  assert.equal(
    /updateWorkspaceUserRole\(workspaceUser, 'manager'\)/i.test(roleEditorHtml),
    true,
    'missing manager role option in workspace user role editor',
  );
  assert.equal(
    /updateWorkspaceUserRole\(workspaceUser, 'member'\)/i.test(roleEditorHtml),
    true,
    'missing member role option in workspace user role editor',
  );
  assert.equal(
    /v-for="workspace in adminWorkspaces"[\s\S]*v-model="selectedUserWorkspaceId"/i.test(
      indexHtml,
    ) ||
      /v-model="selectedUserWorkspaceId"[\s\S]*v-for="workspace in adminWorkspaces"/i.test(
        indexHtml,
      ),
    true,
    'workspace user management selector should include only admin workspaces',
  );
  assert.equal(
    /Workspace owner/.test(indexHtml),
    true,
    'admin users should remain visible with owner label',
  );
});

test('AppController updates the path when switching top-level views', () => {
  const { restore, getHref } = createWindowAndStorage();
  try {
    const state = createAppControllerState();

    state.setView('availability');
    assert.equal(state.currentView.value, 'availability');
    assert.equal(getHref(), '/services');

    state.setView('admin');
    assert.equal(state.currentView.value, 'admin');
    assert.equal(getHref(), '/administration');

    state.setView('overview');
    assert.equal(state.currentView.value, 'overview');
    assert.equal(getHref(), '/overview');
  } finally {
    restore();
  }
});

test('LoginController resets loaded password reset captcha when email changes', async () => {
  const originalRequestChallenge = PasswordResetService.requestChallenge;
  PasswordResetService.requestChallenge = async () => ({
    challengeId: 'reset-challenge-id',
    challengePrompt: '2 + 2?',
  });

  const { restore } = createWindowAndStorage();
  try {
    const state = createLoginControllerState();

    state.openForgotMode();
    await state.loadResetChallenge();

    assert.equal(state.forgotChallengeId.value, 'reset-challenge-id');
    assert.equal(state.forgotChallengePrompt.value, '2 + 2?');

    state.forgotRequestError.value = 'Invalid captcha';
    state.forgotRequestSuccess.value = true;
    state.forgotChallengeAnswer.value = '4';
    state.forgotEmail.value = 'updated@example.com';
    state.resetForgotChallenge();

    assert.equal(state.forgotChallengeId.value, '');
    assert.equal(state.forgotChallengePrompt.value, '');
    assert.equal(state.forgotChallengeAnswer.value, '');
    assert.equal(state.forgotRequestError.value, '');
    assert.equal(state.forgotRequestSuccess.value, false);
  } finally {
    PasswordResetService.requestChallenge = originalRequestChallenge;
    restore();
  }
});

test('AccountActivationService validates and activates tokens through unauthenticated endpoints', async () => {
  if (!AccountActivationService) {
    assert.fail('AccountActivationService is not available in browser bundle');
  }

  const { get, restore } = createWindowAndStorage();
  const fetch = setupFetchMock(() =>
    Promise.resolve(
      createMockResponse(200, {
        ok: true,
        token: 'activated-token',
        token_type: 'Bearer',
        expires_in_seconds: 600,
      }),
    ),
  );
  const originalNow = Date.now;
  (Date as { now: () => number }).now = () => 2_000;

  try {
    const validate =
      AccountActivationService.validate ??
      AccountActivationService.validateActivationToken;
    if (!validate) {
      fetch.restore();
      restore();
      assert.fail('AccountActivationService.validate is not available');
    }

    const tokenPayload = { token: 'activation-token' };
    const isValid = await validate(tokenPayload);
    assert.equal(isValid, true);

    const validateBody = JSON.parse(
      fetch.state[fetch.state.length - 1]?.body ?? '{}',
    ) as Record<string, string>;
    assert.equal(validateBody.token, tokenPayload.token);
    assert.equal(
      getHeader(fetch.state[fetch.state.length - 1], 'Authorization'),
      null,
    );

    const activate =
      AccountActivationService.activate ??
      AccountActivationService.activateAccount;
    if (!activate) {
      fetch.restore();
      restore();
      assert.fail('AccountActivationService.activate is not available');
    }

    await activate(tokenPayload);

    const activateBody = JSON.parse(
      fetch.state[fetch.state.length - 1]?.body ?? '{}',
    ) as Record<string, string>;
    assert.equal(activateBody.token, tokenPayload.token);
    assert.equal(
      getHeader(fetch.state[fetch.state.length - 1], 'Authorization'),
      null,
    );
    assert.equal(get('auth_token'), 'activated-token');
    assert.equal(get('auth_token_expires_at_ms'), String(2_000 + 600_000));
  } finally {
    (Date as { now: () => number }).now = originalNow;
  }

  fetch.restore();
  restore();
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
