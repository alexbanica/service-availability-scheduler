import assert from 'node:assert/strict';
import express, { Response } from 'express';
import test from 'node:test';
import type { Request } from 'express';

import { PageController } from '../../controllers/PageController';

type RouteHandler = (req: Request, res: Response) => void;

function getRouteHandler(app: express.Express, path: string): RouteHandler {
  const routeLayer = (
    app as unknown as { _router: { stack: unknown[] } }
  )._router.stack.find((layer) => {
    const route = (
      layer as { route?: { path?: string; methods?: Record<string, boolean> } }
    ).route;
    return route?.path === path && route.methods?.get === true;
  }) as
    | {
        route: {
          stack: Array<{ handle: RouteHandler }>;
        };
      }
    | undefined;

  assert.ok(routeLayer, `GET ${path} not found`);
  return routeLayer.route.stack[0].handle;
}

function createResponse(): {
  response: Response;
  headers: Record<string, string>;
  sentFiles: string[];
} {
  const headers: Record<string, string> = {};
  const sentFiles: string[] = [];
  const response = {
    set(values: Record<string, string>) {
      Object.assign(headers, values);
      return this;
    },
    sendFile(filePath: string) {
      sentFiles.push(filePath);
      return this;
    },
  } as unknown as Response;

  return { response, headers, sentFiles };
}

function createJsonResponse(): {
  response: Response;
  getPayload: () => unknown;
} {
  let payload: unknown = null;
  const response = {
    json(body: unknown) {
      payload = body;
      return this;
    },
  } as unknown as Response;

  return { response, getPayload: () => payload };
}

test('PageController disables browser caching for authenticated app page', () => {
  const app = express();
  new PageController('/repo').register(app);
  for (const appPath of ['/', '/overview', '/services', '/administration']) {
    const handler = getRouteHandler(app, appPath);
    const { response, headers, sentFiles } = createResponse();

    handler({} as Request, response);

    assert.equal(
      headers['Cache-Control'],
      'no-store, no-cache, must-revalidate, private',
    );
    assert.equal(headers.Pragma, 'no-cache');
    assert.equal(headers.Expires, '0');
    assert.equal(sentFiles[0], '/repo/public/index.html');
  }
});

test('PageController serves registration page under /register', () => {
  const app = express();
  new PageController('/repo').register(app);
  const handler = getRouteHandler(app, '/register');
  const { response, headers, sentFiles } = createResponse();

  handler({} as Request, response);

  assert.equal(
    headers['Cache-Control'],
    'no-store, no-cache, must-revalidate, private',
  );
  assert.equal(sentFiles[0], '/repo/public/login.html');
});

test('PageController disables browser caching for workspace invitation page', () => {
  const app = express();
  new PageController('/repo').register(app);
  const handler = getRouteHandler(app, '/workspace-invitations/:code');
  const { response, headers, sentFiles } = createResponse();

  handler({ params: { code: 'abc' } } as unknown as Request, response);

  assert.equal(
    headers['Cache-Control'],
    'no-store, no-cache, must-revalidate, private',
  );
  assert.equal(headers.Pragma, 'no-cache');
  assert.equal(headers.Expires, '0');
  assert.equal(sentFiles[0], '/repo/public/workspace-invitation.html');
});

test('PageController exposes app info with Google auth disabled when client id is missing', () => {
  const previous = process.env.GOOGLE_AUTH_CLIENT_ID;
  const previousRecaptchaSiteKey = process.env.GOOGLE_RECAPTCHA_SITE_KEY;
  const app = express();
  new PageController('/repo').register(app);
  const handler = getRouteHandler(app, '/api/app-info');
  const { response, getPayload } = createJsonResponse();

  delete process.env.GOOGLE_AUTH_CLIENT_ID;
  delete process.env.GOOGLE_RECAPTCHA_SITE_KEY;
  handler({} as Request, response);

  const payload = getPayload() as {
    google_auth_enabled?: boolean;
    google_auth_client_id?: string;
    recaptcha_enabled?: boolean;
    recaptcha_site_key?: string;
  };
  assert.equal(payload.google_auth_enabled, false);
  assert.equal(payload.recaptcha_enabled, false);
  assert.equal(
    typeof payload.google_auth_client_id === 'undefined' ||
      payload.google_auth_client_id === '',
    true,
  );
  assert.equal(
    typeof payload.recaptcha_site_key === 'undefined' ||
      payload.recaptcha_site_key === '',
    true,
  );

  if (typeof previous === 'undefined') {
    delete process.env.GOOGLE_AUTH_CLIENT_ID;
  } else {
    process.env.GOOGLE_AUTH_CLIENT_ID = previous;
  }
  if (typeof previousRecaptchaSiteKey === 'undefined') {
    delete process.env.GOOGLE_RECAPTCHA_SITE_KEY;
  } else {
    process.env.GOOGLE_RECAPTCHA_SITE_KEY = previousRecaptchaSiteKey;
  }
});

test('PageController exposes app info with Google auth enabled when client id is configured', () => {
  const previous = process.env.GOOGLE_AUTH_CLIENT_ID;
  process.env.GOOGLE_AUTH_CLIENT_ID = 'test-google-client-id';
  const app = express();
  new PageController('/repo').register(app);
  const handler = getRouteHandler(app, '/api/app-info');
  const { response, getPayload } = createJsonResponse();

  handler({} as Request, response);

  const payload = getPayload() as {
    google_auth_enabled?: boolean;
    google_auth_client_id?: string;
  };
  assert.equal(payload.google_auth_enabled, true);
  assert.equal(payload.google_auth_client_id, 'test-google-client-id');

  if (typeof previous === 'undefined') {
    delete process.env.GOOGLE_AUTH_CLIENT_ID;
  } else {
    process.env.GOOGLE_AUTH_CLIENT_ID = previous;
  }
});

test('PageController exposes app info with reCAPTCHA enabled when site key is configured', () => {
  const previous = process.env.GOOGLE_RECAPTCHA_SITE_KEY;
  process.env.GOOGLE_RECAPTCHA_SITE_KEY = 'test-recaptcha-site-key';
  const app = express();
  new PageController('/repo').register(app);
  const handler = getRouteHandler(app, '/api/app-info');
  const { response, getPayload } = createJsonResponse();

  handler({} as Request, response);

  const payload = getPayload() as {
    recaptcha_enabled?: boolean;
    recaptcha_site_key?: string;
    recaptcha_secret_key?: string;
  };
  assert.equal(payload.recaptcha_enabled, true);
  assert.equal(payload.recaptcha_site_key, 'test-recaptcha-site-key');
  assert.equal(payload.recaptcha_secret_key, undefined);

  if (typeof previous === 'undefined') {
    delete process.env.GOOGLE_RECAPTCHA_SITE_KEY;
  } else {
    process.env.GOOGLE_RECAPTCHA_SITE_KEY = previous;
  }
});
