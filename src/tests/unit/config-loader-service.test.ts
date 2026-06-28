import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ConfigLoaderService } from '../../services/ConfigLoaderService';

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

test('missing auto_refresh_minutes uses default value', () => {
  const configPath = writeTempAppConfig('expiry_warning_minutes: 5\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshMinutes, 2);
    assert.equal(config.expiryWarningMinutes, 5);
  } finally {
    cleanupConfig(configPath);
  }
});

test('valid auto_refresh_minutes is parsed as number', () => {
  const configPath = writeTempAppConfig('auto_refresh_minutes: 7\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshMinutes, 7);
  } finally {
    cleanupConfig(configPath);
  }
});

test('zero auto_refresh_minutes remains zero from file parsing', () => {
  const configPath = writeTempAppConfig('auto_refresh_minutes: 0\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshMinutes, 0);
  } finally {
    cleanupConfig(configPath);
  }
});

test('negative auto_refresh_minutes remains negative from file parsing', () => {
  const configPath = writeTempAppConfig('auto_refresh_minutes: -3\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.equal(config.autoRefreshMinutes, -3);
  } finally {
    cleanupConfig(configPath);
  }
});

test('invalid auto_refresh_minutes maps to NaN', () => {
  const configPath = writeTempAppConfig('auto_refresh_minutes: invalid\n');
  try {
    const config = new ConfigLoaderService().loadConfig(configPath);
    assert.ok(Number.isNaN(config.autoRefreshMinutes));
  } finally {
    cleanupConfig(configPath);
  }
});
