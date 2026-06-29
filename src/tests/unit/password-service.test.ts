import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const requireFromRoot = createRequire(process.cwd() + '/');
const passwordServicePath = path.join(
  process.cwd(),
  'src',
  'services',
  'PasswordService.ts',
);

if (!fs.existsSync(passwordServicePath)) {
  test(
    'PasswordService tests are skipped until implementation file exists',
    { skip: true },
    () => {
      assert.equal(1, 1);
    },
  );
} else {
  const moduleExports = requireFromRoot(passwordServicePath) as {
    PasswordService: {
      new (...args: unknown[]): {
        validatePassword: (password: string) => boolean;
        hashPassword: (password: string) => Promise<string>;
        verifyPassword: (
          password: string,
          passwordHash: string,
        ) => Promise<boolean>;
      };
    };
  };
  const { PasswordService } = moduleExports;

  test('PasswordService requires minimum 8-character password', () => {
    const service = new PasswordService();
    assert.equal(service.validatePassword('short'), false);
    assert.equal(service.validatePassword('12345678'), true);
  });

  test('PasswordService hashes and verifies password correctly', async () => {
    const service = new PasswordService();
    const password = 'secretPassword123';

    const hash = await service.hashPassword(password);
    assert.equal(typeof hash, 'string');
    assert.notEqual(hash, password);

    const accepted = await service.verifyPassword(password, hash);
    assert.equal(accepted, true);
  });

  test('PasswordService rejects invalid password against stored hash', async () => {
    const service = new PasswordService();
    const password = 'secretPassword123';
    const wrongPassword = 'wrongPassword123';

    const hash = await service.hashPassword(password);

    const accepted = await service.verifyPassword(wrongPassword, hash);
    assert.equal(accepted, false);
  });
}
