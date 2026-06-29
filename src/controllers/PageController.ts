import path from 'node:path';
import type { Express, Request, Response } from 'express';

export class PageController {
  constructor(private readonly rootDir: string) {}

  register(app: Express): void {
    app.get('/login', (_req: Request, res: Response) => {
      this.disablePageCache(res);
      res.sendFile(path.join(this.rootDir, 'public', 'login.html'));
    });

    app.get('/reset-password/:token', (_req: Request, res: Response) => {
      this.disablePageCache(res);
      res.sendFile(path.join(this.rootDir, 'public', 'reset-password.html'));
    });

    app.get('/api/app-info', (_req: Request, res: Response) => {
      res.json({
        version: process.env.APP_VERSION || 'development',
      });
    });

    app.get('/', (_req: Request, res: Response) => {
      this.disablePageCache(res);
      res.sendFile(path.join(this.rootDir, 'public', 'index.html'));
    });
  }

  private disablePageCache(res: Response): void {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
  }
}
