import test from 'node:test';
import assert from 'node:assert/strict';
import { JwtAuthService } from '../../services/JwtAuthService';

// Expected production API under test:
// new JwtAuthService(jwtSecret: string, jwtExpiresInSeconds: number)
// issueToken(identity) and verifyToken(token) methods.

type JwtUserIdentity = {
  id?: string;
  userId?: string;
  email: string;
  nickname: string;
};

type JwtPayload = {
  id?: string;
  userId?: string;
  email: string;
  nickname: string;
  iat?: number;
  exp?: number;
};

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid token format');
  }
  const payloadBase64Url = parts[1];
  const payloadBase64 = payloadBase64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(payloadBase64Url.length + (4 - (payloadBase64Url.length % 4)) % 4, '=');

  const decoded = Buffer.from(payloadBase64, 'base64').toString('utf8');
  return JSON.parse(decoded) as JwtPayload;
}

function identityId(identity: JwtUserIdentity): string {
  if (!identity.id && !identity.userId) {
    throw new Error('Expected identity.userId or identity.id');
  }
  return identity.id ?? identity.userId!;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAuthService(
  jwtSecret = 'test-secret',
  jwtExpiresInSeconds = 3600,
): JwtAuthService {
  return new JwtAuthService(jwtSecret, jwtExpiresInSeconds);
}

test('issued token verifies to user id/email/nickname', async () => {
  const authService = createAuthService();
  const identity = {
    userId: 'user-1',
    email: 'alice@example.com',
    nickname: 'Alice',
  };

  const token = await Promise.resolve(authService.issueToken(identity));
  const verified = await Promise.resolve(authService.verifyToken(token));

  assert.equal(identityId(verified as JwtUserIdentity), identity.userId);
  assert.equal(verified.email, identity.email);
  assert.equal(verified.nickname, identity.nickname);
});

test('issued token uses configured lifetime', async () => {
  const authService = createAuthService('test-secret', 45);
  const identity = {
    id: 'user-2',
    email: 'bob@example.com',
    nickname: 'Bob',
  };

  const token = await Promise.resolve(authService.issueToken(identity));
  const payload = decodeJwtPayload(token);
  assert.equal(typeof payload.iat, 'number');
  assert.equal(typeof payload.exp, 'number');
  assert.ok(payload.exp! - payload.iat! === 45);
});

test('expired token is rejected', async () => {
  const authService = createAuthService('test-secret', 1);
  const identity = {
    userId: 'user-3',
    email: 'charlie@example.com',
    nickname: 'Charlie',
  };

  const token = await Promise.resolve(authService.issueToken(identity));
  await wait(1200);
  await assert.rejects(
    () => Promise.resolve(authService.verifyToken(token)),
    /expired/i,
  );
});

test('malformed token is rejected', async () => {
  const authService = createAuthService();
  await assert.rejects(
    () => Promise.resolve(authService.verifyToken('not.a.jwt.token')),
    /invalid|malformed/i,
  );
});
