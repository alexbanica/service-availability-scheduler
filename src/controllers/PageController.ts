import path from 'path';
import type { Express, Request, Response } from 'express';
import { requireAuth } from './AuthMiddleware';

export class PageController {
  constructor(private readonly rootDir: string) {}

  register(app: Express): void {
    app.get('/login', (req: Request, res: Response) => {
      if (req.session.userId) {
        res.redirect('/');
        return;
      }
      res.sendFile(path.join(this.rootDir, 'public', 'login.html'));
    });

    app.get('/api/app-info', requireAuth, (_req: Request, res: Response) => {
      res.json({
        version: process.env.APP_VERSION || '',
      });
    });

    app.get('/', requireAuth, (req: Request, res: Response) => {
      res.sendFile(path.join(this.rootDir, 'public', 'index.html'));
    });
  }
}
