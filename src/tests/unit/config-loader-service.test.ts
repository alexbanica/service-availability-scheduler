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
