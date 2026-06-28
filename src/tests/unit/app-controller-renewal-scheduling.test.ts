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
  const result = spawnSync('npx', [
    'tsc',
    '-p',
    'tsconfig.client.json',
    '--outDir',
    buildRoot,
    '--module',
    'commonjs',
  ], {
    stdio: 'ignore',
  });

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
    prototype: { scheduleTokenRenewal: () => void };
    new (): {
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
  };
};

test('non-401 token renewal failure schedules a delayed retry', async () => {
  const previousWindow = (globalThis as { window?: { setTimeout: unknown; clearTimeout: unknown } })
    .window;

  const calls: Array<{ delay: number; callback: () => Promise<unknown> | unknown }> = [];
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
  await (controller as { scheduleTokenRenewal: () => void }).scheduleTokenRenewal();
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
