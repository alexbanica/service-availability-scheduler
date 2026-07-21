import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromRoot = createRequire(process.cwd() + '/');
const buildRoot = path.join(os.tmpdir(), 'sas-app-controller-renewal-tests');

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
    deleteAccount?: (confirmationEmail: string) => Promise<void>;
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
      stop?: () => void;
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
  adminSection?: { value: 'workspace' | 'services' | 'users' };
  setAdminSection?: (section: 'workspace' | 'services' | 'users') => void;
  isAccountDeletionModalOpen?: { value: boolean };
  accountDeletionConfirmation?: { value: string };
  accountDeletionError?: { value: string };
  openAccountDeletionModal?: () => void;
  deleteAccount?: () => Promise<void>;
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
  const watchers = new WeakMap<object, Array<(value: unknown) => void>>();

  const fakeVue = {
    createApp: (options: { setup: () => AppState }) => {
      state = options.setup();
      return {
        mount: () => {
          return;
        },
      };
    },
    ref: (initialValue: unknown) => {
      let value = initialValue;
      const source = {
        get value() {
          return value;
        },
        set value(nextValue: unknown) {
          value = nextValue;
          for (const callback of watchers.get(source) ?? []) {
            callback(nextValue);
          }
        },
      };
      return source;
    },
    computed: (fn: () => unknown) => ({
      get value() {
        return fn();
      },
    }),
    onMounted: (callback: () => Promise<void> | void) => {
      onMountedCallback = callback;
    },
    watch: (source: object, callback: (value: unknown) => void) => {
      const callbacks = watchers.get(source) ?? [];
      callbacks.push(callback);
      watchers.set(source, callbacks);
    },
    nextTick: (callback?: () => void) => {
      callback?.();
      return Promise.resolve();
    },
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
  const originalWorkspaceUsers = WorkspaceService.listWorkspaceUsers;
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
  let userListRequested = false;
  WorkspaceService.listWorkspaceUsers = async () => {
    userListRequested = true;
    return [];
  };
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
  state.setAdminSection?.('services');
  assert.equal(state.adminSection?.value, 'services');
  state.setAdminSection?.('users');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state.selectedUserWorkspaceId?.value, null);
  assert.equal(state.selectedWorkspaceUsers?.value.length, 0);
  assert.equal(userListRequested, false);

  AuthService.loadUser = originalLoadUser;
  AuthService.isAuthenticated = originalIsAuthenticated;
  WorkspaceService.list = originalWorkspaceList;
  WorkspaceService.listWorkspaceUsers = originalWorkspaceUsers;
  WorkspaceService.listEnvironments = originalListEnvironments;
  WorkspaceService.listOwners = originalListOwners;
  WorkspaceService.listServiceCatalog = originalListServiceCatalog;
  ReservationService.loadServices = originalLoadServices;
  ApiService.get = originalApiGet;
  EventsService.prototype.start = originalEventsStart;
  restoreLocalStorage();
});

test('AppController shows all workspaces for read-only administration and filters user management to admins', async () => {
  const restoreLocalStorage = installLocalStorage();
  const originalLoadUser = AuthService.loadUser;
  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalWorkspaceList = WorkspaceService.list;
  const originalWorkspaceUsers = WorkspaceService.listWorkspaceUsers;
  const originalLoadServices = ReservationService.loadServices;
  const originalListEnvironments = WorkspaceService.listEnvironments;
  const originalListOwners = WorkspaceService.listOwners;
  const originalListServiceCatalog = WorkspaceService.listServiceCatalog;
  const originalApiGet = ApiService.get;
  const originalEventsStart = EventsService.prototype.start;

  AuthService.loadUser = async () =>
    ({
      id: 'mixed-role-user',
      email: 'mixed@example.com',
      nickname: 'Mixed',
      activated: true,
    }) as never;
  AuthService.isAuthenticated = () => false;
  WorkspaceService.list = async () =>
    [
      {
        id: 'workspace-admin',
        name: 'Admin Workspace',
        adminUserId: 'mixed-role-user',
        currentUserRole: 'admin',
      },
      {
        id: 'workspace-manager',
        name: 'Manager Workspace',
        adminUserId: 'other-user',
        currentUserRole: 'manager',
      },
      {
        id: 'workspace-member',
        name: 'Member Workspace',
        adminUserId: 'other-user',
        currentUserRole: 'member',
      },
    ] as never;
  WorkspaceService.listEnvironments = async () => [];
  WorkspaceService.listOwners = async () => [];
  WorkspaceService.listServiceCatalog = async () => [];
  let userWorkspaceId: string | null = null;
  WorkspaceService.listWorkspaceUsers = async (workspaceId: string) => {
    userWorkspaceId = workspaceId;
    return [];
  };
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
  assert.equal(state.adminWorkspaces?.value.length, 1);
  assert.equal(state.resourceAdminWorkspaces?.value.length, 2);
  assert.equal(state.selectedServiceWorkspaceId?.value, 'workspace-admin');
  state.selectedServiceWorkspaceId!.value = 'workspace-member';
  assert.equal(state.selectedServiceWorkspaceIsAdmin?.value, false);

  state.selectedUserWorkspaceId!.value = 'workspace-member';
  state.setAdminSection?.('users');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(state.selectedUserWorkspaceId?.value, 'workspace-admin');
  assert.equal(userWorkspaceId, 'workspace-admin');

  AuthService.loadUser = originalLoadUser;
  AuthService.isAuthenticated = originalIsAuthenticated;
  WorkspaceService.list = originalWorkspaceList;
  WorkspaceService.listWorkspaceUsers = originalWorkspaceUsers;
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

test('successful account deletion clears user state, stops background work, preserves theme, and redirects to login', async () => {
  const restoreLocalStorage = installLocalStorage();
  const browserStorage = (globalThis as unknown as { localStorage: Storage })
    .localStorage;
  const browserWindow = (
    globalThis as unknown as {
      window: Record<string, unknown>;
    }
  ).window;
  const originalLoadUser = AuthService.loadUser;
  const originalIsAuthenticated = AuthService.isAuthenticated;
  const originalRenew = AuthService.renew;
  const originalDeleteAccount = AuthService.deleteAccount;
  const originalWorkspaceList = WorkspaceService.list;
  const originalLoadServices = ReservationService.loadServices;
  const originalApiGet = ApiService.get;
  const originalEventsStart = EventsService.prototype.start;
  const originalEventsStop = EventsService.prototype.stop;
  const clearedTimeouts: unknown[] = [];
  const clearedIntervals: unknown[] = [];
  const timers: Array<{
    id: number;
    callback: () => unknown;
    delay: number;
  }> = [];
  let nextTimerId = 1;
  let eventsStopped = 0;
  let href = '/overview';
  let resolveRenewal!: (renewed: boolean) => void;

  browserWindow.location = {
    get href() {
      return href;
    },
    set href(value: string) {
      href = value;
    },
  };
  browserWindow.setTimeout = (callback: () => unknown, delay: number = 0) => {
    const id = nextTimerId++;
    timers.push({ id, callback, delay });
    return id;
  };
  browserWindow.clearTimeout = (timerId: unknown) => {
    clearedTimeouts.push(timerId);
  };
  browserWindow.setInterval = () => nextTimerId++;
  browserWindow.clearInterval = (timerId: unknown) => {
    clearedIntervals.push(timerId);
  };

  browserStorage.setItem('auth_token', 'stored-token');
  browserStorage.setItem('auth_token_expires_at_ms', '999999999');
  browserStorage.setItem('ownerFilter', 'platform');
  browserStorage.setItem('workspaceFilter', 'workspace-1');
  browserStorage.setItem('serviceManagementWorkspace', 'workspace-1');
  browserStorage.setItem('theme', 'dark');

  AuthService.loadUser = async () => ({
    id: 'user-1',
    email: 'alice@example.com',
    nickname: 'Alice',
    activated: true,
  });
  AuthService.isAuthenticated = () => true;
  AuthService.renew = () =>
    new Promise<boolean>((resolve) => {
      resolveRenewal = resolve;
    });
  AuthService.deleteAccount = async () => {
    browserStorage.removeItem('auth_token');
    browserStorage.removeItem('auth_token_expires_at_ms');
  };
  WorkspaceService.list = async () => [];
  ReservationService.loadServices = async () => ({
    expiryWarningMinutes: 5,
    autoRefreshSeconds: 30,
    services: [],
  });
  ApiService.get = async () => createMockResponse(200, { version: 'test' });
  EventsService.prototype.start = () => {
    return;
  };
  EventsService.prototype.stop = () => {
    eventsStopped += 1;
  };

  try {
    const { state, runMounted } = createAppControllerWithFakeVue();
    await runMounted();
    const renewalTimer = timers.find((timer) => timer.delay === 0);
    assert.ok(renewalTimer, 'expected token renewal to be scheduled');
    const inFlightRenewal = renewalTimer.callback() as Promise<void>;
    assert.equal(typeof state.openAccountDeletionModal, 'function');
    state.openAccountDeletionModal?.();
    state.accountDeletionConfirmation!.value = 'alice@example.com';
    await state.deleteAccount?.();
    const timerCountAfterDeletion = timers.length;

    browserStorage.setItem('auth_token', 'stale-renewed-token');
    browserStorage.setItem('auth_token_expires_at_ms', '9999999999999');
    resolveRenewal(true);
    await inFlightRenewal;

    assert.equal(state.user.value, null);
    assert.equal(state.isAccountDeletionModalOpen?.value, false);
    assert.equal(state.accountDeletionConfirmation?.value, '');
    assert.equal(state.accountDeletionError?.value, '');
    assert.equal(browserStorage.getItem('auth_token'), null);
    assert.equal(browserStorage.getItem('auth_token_expires_at_ms'), null);
    assert.equal(browserStorage.getItem('ownerFilter'), null);
    assert.equal(browserStorage.getItem('workspaceFilter'), null);
    assert.equal(browserStorage.getItem('serviceManagementWorkspace'), null);
    assert.equal(browserStorage.getItem('theme'), 'dark');
    assert.equal(eventsStopped, 1);
    assert.equal(
      timers.length,
      timerCountAfterDeletion,
      'stale renewal must not schedule protected work',
    );
    assert.ok(
      clearedTimeouts.length + clearedIntervals.length > 0,
      'expected account deletion to cancel renewal and refresh timers',
    );
    assert.equal(href, '/login');
  } finally {
    AuthService.loadUser = originalLoadUser;
    AuthService.isAuthenticated = originalIsAuthenticated;
    AuthService.renew = originalRenew;
    AuthService.deleteAccount = originalDeleteAccount;
    WorkspaceService.list = originalWorkspaceList;
    ReservationService.loadServices = originalLoadServices;
    ApiService.get = originalApiGet;
    EventsService.prototype.start = originalEventsStart;
    EventsService.prototype.stop = originalEventsStop;
    restoreLocalStorage();
  }
});
