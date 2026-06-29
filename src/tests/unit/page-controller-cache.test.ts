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

test('PageController disables browser caching for authenticated app page', () => {
  const app = express();
  new PageController('/repo').register(app);
  for (const appPath of [
    '/',
    '/overview',
    '/services',
    '/administration',
  ]) {
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
