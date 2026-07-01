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
  mkdirSync(path.join(buildRoot, 'controllers'), { recursive: true });
}

compileBrowserBundle();

const { AppController } = requireFromRoot(
  path.join(buildRoot, 'controllers/AppController.js'),
) as {
  AppController: {
    prototype: {
      bootstrap: (vue: unknown) => void;
      scheduleTokenRenewal: () => void;
    };
    new (): {
      bootstrap: (vue: unknown) => void;
      scheduleTokenRenewal: () => void;
    };
  };
};
const { AuthService } = requireFromRoot(
  path.join(buildRoot, 'services/AuthService.js'),
) as {
  AuthService: {
    hasToken: () => boolean;
    isTokenRenewalDue: () => boolean;
    renew: () => Promise<boolean>;
    loadUser: () => Promise<{
      id: string;
      email: string;
      nickname: string;
      activated?: boolean;
    } | null>;
    isAuthenticated: () => boolean;
  };
};

const { WorkspaceService } = requireFromRoot(
  path.join(buildRoot, 'services/WorkspaceService.js'),
) as {
  WorkspaceService: {
    list: () => Promise<unknown[]>;
    listEnvironments: (workspaceId: string) => Promise<unknown[]>;
    listOwners: (workspaceId: string) => Promise<unknown[]>;
    listServiceCatalog: (workspaceId: string) => Promise<unknown[]>;
    listWorkspaceUsers: (workspaceId: string) => Promise<unknown[]>;
  };
};

const { ReservationService } = requireFromRoot(
  path.join(buildRoot, 'services/ReservationService.js'),
) as {
  ReservationService: {
    loadServices: () => Promise<{
      expiryWarningMinutes: number;
      autoRefreshSeconds: number;
      services: unknown[];
    }>;
  };
};

const { ApiService } = requireFromRoot(
  path.join(buildRoot, 'services/ApiService.js'),
) as {
  ApiService: {
    get: (path: string) => Promise<Response>;
  };
};

const { EventsService } = requireFromRoot(
  path.join(buildRoot, 'services/EventsService.js'),
) as {
  EventsService: {
    prototype: {
      start: (onExpiring: unknown) => void;
    };
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

type AppState = {
  user: { value: { activated?: boolean } | null };
  showActivationBanner?: { value: boolean };
  canUseProtectedActions?: { value: boolean };
  adminWorkspaces?: { value: unknown[] };
  resourceAdminWorkspaces?: { value: unknown[] };
  canAccessAdministration?: { value: boolean };
  selectedServiceWorkspaceId?: { value: string | null };
  selectedServiceWorkspaceIsAdmin?: { value: boolean };
  selectedUserWorkspaceId?: { value: string | null };
  selectedWorkspaceUsers?: { value: unknown[] };
  setAdminSection?: (section: 'workspace' | 'services' | 'users') => void;
};

function installLocalStorage(): () => void {
  const previousLocalStorage = (globalThis as { localStorage?: unknown })
    .localStorage;
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousDocument = (globalThis as { document?: unknown }).document;
  const storage = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
  (globalThis as { window?: unknown }).window = {
    matchMedia: () => ({ matches: false }),
    setTimeout: () => 0,
    clearTimeout: () => undefined,
  };
  (globalThis as { document?: unknown }).document = {
    documentElement: {
      dataset: {},
    },
  };

  return () => {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (previousDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = previousDocument;
    }

    if (previousLocalStorage === undefined) {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      return;
    }
    (globalThis as { localStorage?: unknown }).localStorage =
      previousLocalStorage;
  };
}

function createAppControllerWithFakeVue(): {
  state: AppState;
  runMounted: () => Promise<void>;
} {
  let state: AppState = { user: { value: null } };
  let onMountedCallback: (() => Promise<void> | void) | null = null;

  const fakeVue = {
    createApp: (options: { setup: () => AppState }) => {
      state = options.setup();
      return {
        mount: () => {
          return;
        },
      };
    },
    ref: (value: unknown) => ({ value }),
    computed: (fn: () => unknown) => ({
      get value() {
        return fn();
      },
    }),
    onMounted: (callback: () => Promise<void> | void) => {
      onMountedCallback = callback;
    },
    watch: () => undefined,
  };

  const controller = new AppController();
  controller.bootstrap(fakeVue as never);

  return {
    state,
    runMounted: async () => {
      if (!onMountedCallback) {
        return;
      }
      await onMountedCallback();
    },
  };
}

test('non-401 token renewal failure schedules a delayed retry', async () => {
  const previousWindow = (
    globalThis as { window?: { setTimeout: unknown; clearTimeout: unknown } }
  ).window;

  const calls: Array<{
    delay: number;
    callback: () => Promise<unknown> | unknown;
  }> = [];
  const originalAuthHasToken = AuthService.hasToken;
  const originalAuthIsTokenRenewalDue = AuthService.isTokenRenewalDue;
  const originalAuthRenew = AuthService.renew;

  Object.defineProperty(globalThis, 'window', {
    value: {
      setTimeout: (callback: () => void, delay?: number) => {
        calls.push({
          delay: delay ?? 0,
          callback,
        });
        return calls.length;
      },
      clearTimeout: () => undefined,
    },
    configurable: true,
  });

  AuthService.hasToken = () => true;
  AuthService.isTokenRenewalDue = () => true;
  AuthService.renew = async () => false;

  const controller = new AppController();
  await (
    controller as { scheduleTokenRenewal: () => void }
  ).scheduleTokenRenewal();
  assert.equal(calls.length, 1);
  await (calls[0].callback as () => Promise<void>)();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].delay, 0);
  assert.equal(calls[1].delay, 30000);

  AuthService.hasToken = originalAuthHasToken;
  AuthService.isTokenRenewalDue = originalAuthIsTokenRenewalDue;
  AuthService.renew = originalAuthRenew;
  if (previousWindow === undefined) {
    delete (globalThis as { window?: object }).window;
  } else {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
    });
  }
});

test('AppController exposes activation-banner state for non-activated user identity', async () => {
  const restoreLocalStorage = installLocalStorage();
  const originalLoadUser = AuthService.loadUser;
  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalWorkspaceList = WorkspaceService.list;
  const originalLoadServices = ReservationService.loadServices;
  const originalApiGet = ApiService.get;
  const originalEventsStart = EventsService.prototype.start;

  AuthService.loadUser = async () =>
    ({
      id: 'user-1',
      email: 'alice@example.com',
      nickname: 'Alice',
      activated: false,
    }) as never;
  AuthService.isAuthenticated = () => false;
  WorkspaceService.list = async () => [];
  ReservationService.loadServices = async () => ({
    expiryWarningMinutes: 5,
    autoRefreshSeconds: 30,
    services: [],
  });
  ApiService.get = async () =>
    Promise.resolve(
      createMockResponse(200, {
        id: 'user-1',
        email: 'alice@example.com',
        nickname: 'Alice',
        activated: false,
      }),
    );
  EventsService.prototype.start = () => {
    return;
  };

  const { state, runMounted } = createAppControllerWithFakeVue();
  await runMounted();

  assert.equal(state.user.value?.activated, false);
  assert.equal(
    typeof state.showActivationBanner,
    'object',
    'Expected AppController.showActivationBanner state when activation is implemented',
  );
  assert.equal(state.showActivationBanner?.value, true);
  assert.equal(state.canUseProtectedActions?.value, false);

  AuthService.loadUser = originalLoadUser;
  AuthService.isAuthenticated = originalIsAuthenticated;
  WorkspaceService.list = originalWorkspaceList;
  ReservationService.loadServices = originalLoadServices;
  ApiService.get = originalApiGet;
  EventsService.prototype.start = originalEventsStart;
  restoreLocalStorage();
});

test('AppController does not show activation banner for activated user identity', async () => {
  const restoreLocalStorage = installLocalStorage();
  const originalLoadUser = AuthService.loadUser;
  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalWorkspaceList = WorkspaceService.list;
  const originalLoadServices = ReservationService.loadServices;
  const originalApiGet = ApiService.get;
  const originalEventsStart = EventsService.prototype.start;

  AuthService.loadUser = async () =>
    ({
      id: 'user-1',
      email: 'alice@example.com',
      nickname: 'Alice',
      activated: true,
    }) as never;
  AuthService.isAuthenticated = () => false;
  WorkspaceService.list = async () => [];
  ReservationService.loadServices = async () => ({
    expiryWarningMinutes: 5,
    autoRefreshSeconds: 30,
    services: [],
  });
  ApiService.get = async () =>
    Promise.resolve(
      createMockResponse(200, {
        id: 'user-1',
        email: 'alice@example.com',
        nickname: 'Alice',
        activated: true,
      }),
    );
  EventsService.prototype.start = () => {
    return;
  };

  const { state, runMounted } = createAppControllerWithFakeVue();
  await runMounted();

  assert.equal(state.user.value?.activated, true);
  assert.equal(
    typeof state.showActivationBanner,
    'object',
    'Expected AppController.showActivationBanner state when activation is implemented',
  );
  assert.equal(state.showActivationBanner?.value, false);
  assert.equal(state.canUseProtectedActions?.value, true);

  AuthService.loadUser = originalLoadUser;
  AuthService.isAuthenticated = originalIsAuthenticated;
  WorkspaceService.list = originalWorkspaceList;
  ReservationService.loadServices = originalLoadServices;
  ApiService.get = originalApiGet;
  EventsService.prototype.start = originalEventsStart;
  restoreLocalStorage();
});

test('AppController exposes manager resource controls without user administration', async () => {
  const restoreLocalStorage = installLocalStorage();
  const originalLoadUser = AuthService.loadUser;
  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalWorkspaceList = WorkspaceService.list;
  const originalLoadServices = ReservationService.loadServices;
  const originalListEnvironments = WorkspaceService.listEnvironments;
  const originalListOwners = WorkspaceService.listOwners;
  const originalListServiceCatalog = WorkspaceService.listServiceCatalog;
  const originalApiGet = ApiService.get;
  const originalEventsStart = EventsService.prototype.start;

  AuthService.loadUser = async () =>
    ({
      id: 'manager-user',
      email: 'manager@example.com',
      nickname: 'Manager',
      activated: true,
    }) as never;
  AuthService.isAuthenticated = () => false;
  WorkspaceService.list = async () =>
    [
      {
        id: 'workspace-1',
        name: 'Managed Workspace',
        adminUserId: 'admin-user',
        currentUserRole: 'manager',
      },
    ] as never;
  WorkspaceService.listEnvironments = async () => [];
  WorkspaceService.listOwners = async () => [];
  WorkspaceService.listServiceCatalog = async () => [];
  ReservationService.loadServices = async () => ({
    expiryWarningMinutes: 5,
    autoRefreshSeconds: 30,
    services: [],
  });
  ApiService.get = async () => createMockResponse(200, { version: 'test' });
  EventsService.prototype.start = () => {
    return;
  };

  const { state, runMounted } = createAppControllerWithFakeVue();
  await runMounted();

  assert.equal(state.canAccessAdministration?.value, true);
  assert.equal(state.adminWorkspaces?.value.length, 0);
  assert.equal(state.resourceAdminWorkspaces?.value.length, 1);
  assert.equal(state.selectedServiceWorkspaceId?.value, 'workspace-1');
  assert.equal(state.selectedServiceWorkspaceIsAdmin?.value, true);
  state.setAdminSection?.('users');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state.selectedUserWorkspaceId?.value, 'workspace-1');
  assert.equal(state.selectedWorkspaceUsers?.value.length, 0);

  AuthService.loadUser = originalLoadUser;
  AuthService.isAuthenticated = originalIsAuthenticated;
  WorkspaceService.list = originalWorkspaceList;
  WorkspaceService.listEnvironments = originalListEnvironments;
  WorkspaceService.listOwners = originalListOwners;
  WorkspaceService.listServiceCatalog = originalListServiceCatalog;
  ReservationService.loadServices = originalLoadServices;
  ApiService.get = originalApiGet;
  EventsService.prototype.start = originalEventsStart;
  restoreLocalStorage();
});

test('AppController exposes admin-only workspace user administration state', async () => {
  const restoreLocalStorage = installLocalStorage();
  const originalLoadUser = AuthService.loadUser;
  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalWorkspaceList = WorkspaceService.list;
  const originalWorkspaceUsers = WorkspaceService.listWorkspaceUsers;
  const originalLoadServices = ReservationService.loadServices;
  const originalApiGet = ApiService.get;
  const originalEventsStart = EventsService.prototype.start;

  AuthService.loadUser = async () =>
    ({
      id: 'admin-user',
      email: 'admin@example.com',
      nickname: 'Admin',
      activated: true,
    }) as never;
  AuthService.isAuthenticated = () => false;
  WorkspaceService.list = async () =>
    [
      {
        id: 'workspace-1',
        name: 'Admin Workspace',
        adminUserId: 'admin-user',
        currentUserRole: 'admin',
      },
    ] as never;
  WorkspaceService.listWorkspaceUsers = async () =>
    [
      {
        userId: 'member-user',
        email: 'member@example.com',
        role: 'member',
      },
    ] as never;
  ReservationService.loadServices = async () => ({
    expiryWarningMinutes: 5,
    autoRefreshSeconds: 30,
    services: [],
  });
  ApiService.get = async () => createMockResponse(200, { version: 'test' });
  EventsService.prototype.start = () => {
    return;
  };

  const { state, runMounted } = createAppControllerWithFakeVue();
  await runMounted();
  assert.equal(state.adminWorkspaces?.value.length, 1);

  state.setAdminSection?.('users');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(state.selectedUserWorkspaceId?.value, 'workspace-1');
  assert.equal(state.selectedWorkspaceUsers?.value.length, 1);

  AuthService.loadUser = originalLoadUser;
  AuthService.isAuthenticated = originalIsAuthenticated;
  WorkspaceService.list = originalWorkspaceList;
  WorkspaceService.listWorkspaceUsers = originalWorkspaceUsers;
  ReservationService.loadServices = originalLoadServices;
  ApiService.get = originalApiGet;
  EventsService.prototype.start = originalEventsStart;
  restoreLocalStorage();
});
