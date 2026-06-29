import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ConfigLoaderService } from '../../services/ConfigLoaderService';

type AppConfigWithJwt = {
  autoRefreshSeconds: number;
  expiryWarningMinutes: number;
  jwtExpiresInSeconds: number;
  passwordResetTokenExpiresInSeconds: number;
  runMigrationsOnStartup: boolean;
};

function writeTempAppConfig(yamlContent: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-loader-'));
  const configPath = path.join(tempDir, 'app.yml');
  fs.writeFileSync(configPath, yamlContent, 'utf8');
  return configPath;
}

function cleanupConfig(configPath: string): void {
  fs.rmSync(path.dirname(configPath), {
    recursive: true,
    force: true,
  });
}

function withEnv<T>(name: string, value: string | undefined, fn: () => T): T {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}

test('missing auto_refresh_seconds uses default value', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshSeconds, 60);
    assert.equal(config.expiryWarningMinutes, 5);
  } finally {
    cleanupConfig(configPath);
  }
});

test('valid auto_refresh_seconds is parsed as number', () => {
  const configPath = writeTempAppConfig('auto_refresh_seconds: 30\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshSeconds, 30);
  } finally {
    cleanupConfig(configPath);
  }
});

test('zero auto_refresh_seconds remains zero from file parsing', () => {
  const configPath = writeTempAppConfig('auto_refresh_seconds: 0\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshSeconds, 0);
  } finally {
    cleanupConfig(configPath);
  }
});

test('negative auto_refresh_seconds remains negative from file parsing', () => {
  const configPath = writeTempAppConfig('auto_refresh_seconds: -3\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshSeconds, -3);
  } finally {
    cleanupConfig(configPath);
  }
});

test('invalid auto_refresh_seconds maps to NaN', () => {
  const configPath = writeTempAppConfig('auto_refresh_seconds: invalid\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.ok(Number.isNaN(config.autoRefreshSeconds));
  } finally {
    cleanupConfig(configPath);
  }
});

test('default jwtExpiresInSeconds is 3600 when not configured', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  try {
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.jwtExpiresInSeconds, 3600);
  } finally {
    cleanupConfig(configPath);
  }
});

test('jwt_expires_in_seconds is parsed from app.yml', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\njwt_expires_in_seconds: 900\n',
  );
  try {
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.jwtExpiresInSeconds, 900);
  } finally {
    cleanupConfig(configPath);
  }
});

test('JWT_EXPIRES_IN_SECONDS env var overrides app.yml value', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\njwt_expires_in_seconds: 900\n',
  );
  const previous = process.env.JWT_EXPIRES_IN_SECONDS;
  process.env.JWT_EXPIRES_IN_SECONDS = '1200';
  try {
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.jwtExpiresInSeconds, 1200);
  } finally {
    if (previous === undefined) {
      delete process.env.JWT_EXPIRES_IN_SECONDS;
    } else {
      process.env.JWT_EXPIRES_IN_SECONDS = previous;
    }
    cleanupConfig(configPath);
  }
});

test('zero jwt_expires_in_seconds is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\njwt_expires_in_seconds: 0\n',
  );
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /jwt_expires_in_seconds/);
  } finally {
    cleanupConfig(configPath);
  }
});

test('negative jwt_expires_in_seconds is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\njwt_expires_in_seconds: -120\n',
  );
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /jwt_expires_in_seconds/);
  } finally {
    cleanupConfig(configPath);
  }
});

test('non-numeric jwt_expires_in_seconds is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\njwt_expires_in_seconds: not-a-number\n',
  );
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /jwt_expires_in_seconds/);
  } finally {
    cleanupConfig(configPath);
  }
});

test('missing password_reset_token_expires_in_seconds uses default value', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  try {
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.passwordResetTokenExpiresInSeconds, 3600);
  } finally {
    cleanupConfig(configPath);
  }
});

test('password_reset_token_expires_in_seconds is parsed from app.yml', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\npassword_reset_token_expires_in_seconds: 900\n',
  );
  try {
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.passwordResetTokenExpiresInSeconds, 900);
  } finally {
    cleanupConfig(configPath);
  }
});

test('PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS env var overrides app.yml value', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\npassword_reset_token_expires_in_seconds: 900\n',
  );
  const previous = process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
  process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = '1200';
  try {
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.passwordResetTokenExpiresInSeconds, 1200);
  } finally {
    if (previous === undefined) {
      delete process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
    } else {
      process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = previous;
    }
    cleanupConfig(configPath);
  }
});

test('zero password_reset_token_expires_in_seconds is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\npassword_reset_token_expires_in_seconds: 0\n',
  );
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /password_reset_token_expires_in_seconds/);
  } finally {
    cleanupConfig(configPath);
  }
});

test('negative password_reset_token_expires_in_seconds is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\npassword_reset_token_expires_in_seconds: -120\n',
  );
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /password_reset_token_expires_in_seconds/);
  } finally {
    cleanupConfig(configPath);
  }
});

test('non-numeric password_reset_token_expires_in_seconds is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\npassword_reset_token_expires_in_seconds: bad\n',
  );
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /password_reset_token_expires_in_seconds/);
  } finally {
    cleanupConfig(configPath);
  }
});

test('non-numeric PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS is rejected', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  const previous = process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
  process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = 'bad';
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS/);
  } finally {
    if (previous === undefined) {
      delete process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
    } else {
      process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = previous;
    }
    cleanupConfig(configPath);
  }
});

test('zero PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\npassword_reset_token_expires_in_seconds: 900\n',
  );
  const previous = process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
  process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = '0';
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS/);
  } finally {
    if (previous === undefined) {
      delete process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
    } else {
      process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = previous;
    }
    cleanupConfig(configPath);
  }
});

test('negative PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS is rejected', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\npassword_reset_token_expires_in_seconds: 900\n',
  );
  const previous = process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
  process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = '-90';
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS/);
  } finally {
    if (previous === undefined) {
      delete process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS;
    } else {
      process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS = previous;
    }
    cleanupConfig(configPath);
  }
});

test('non-numeric JWT_EXPIRES_IN_SECONDS is rejected', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  const previous = process.env.JWT_EXPIRES_IN_SECONDS;
  process.env.JWT_EXPIRES_IN_SECONDS = 'bad';
  try {
    assert.throws(() => {
      new ConfigLoaderService().loadConfig(configPath);
    }, /JWT_EXPIRES_IN_SECONDS/);
  } finally {
    if (previous === undefined) {
      delete process.env.JWT_EXPIRES_IN_SECONDS;
    } else {
      process.env.JWT_EXPIRES_IN_SECONDS = previous;
    }
    cleanupConfig(configPath);
  }
});

test('missing RUN_MIGRATIONS_ON_STARTUP defaults to true', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  const previous = process.env.RUN_MIGRATIONS_ON_STARTUP;
  try {
    delete process.env.RUN_MIGRATIONS_ON_STARTUP;
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.runMigrationsOnStartup, true);
  } finally {
    if (previous === undefined) {
      delete process.env.RUN_MIGRATIONS_ON_STARTUP;
    } else {
      process.env.RUN_MIGRATIONS_ON_STARTUP = previous;
    }
    cleanupConfig(configPath);
  }
});

test('RUN_MIGRATIONS_ON_STARTUP=false disables startup migrations', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  return withEnv('RUN_MIGRATIONS_ON_STARTUP', 'false', () => {
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.runMigrationsOnStartup, false);
  });
});

test('run_migrations_on_startup false in app.yml disables startup migrations', () => {
  const configPath = writeTempAppConfig(
    'expiry_warning_minutes: 5\nrun_migrations_on_startup: false\n',
  );
  const previous = process.env.RUN_MIGRATIONS_ON_STARTUP;
  try {
    if (previous !== undefined) {
      delete process.env.RUN_MIGRATIONS_ON_STARTUP;
    }
    const config = new ConfigLoaderService().loadConfig(
      configPath,
    ) as AppConfigWithJwt;
    assert.equal(config.runMigrationsOnStartup, false);
  } finally {
    if (previous === undefined) {
      delete process.env.RUN_MIGRATIONS_ON_STARTUP;
    } else {
      process.env.RUN_MIGRATIONS_ON_STARTUP = previous;
    }
    cleanupConfig(configPath);
  }
});

test('non-boolean RUN_MIGRATIONS_ON_STARTUP is rejected', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  try {
    withEnv('RUN_MIGRATIONS_ON_STARTUP', 'not-a-boolean', () => {
      assert.throws(() => {
        new ConfigLoaderService().loadConfig(configPath);
      }, /RUN_MIGRATIONS_ON_STARTUP/);
    });
  } finally {
    cleanupConfig(configPath);
  }
});
