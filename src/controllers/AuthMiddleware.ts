import type { Express, NextFunction, Request, Response } from 'express';
import type { JwtAuthService } from '../services/JwtAuthService';

export type AuthenticatedUser = {
  userId: string;
  email: string;
  nickname: string;
};

type AuthenticatedRequest = Request & {
  authenticatedUser: AuthenticatedUser;
};

interface JwtAuthServiceLike {
  verifyToken(token: string): Promise<AuthenticatedUser>;
}

function getJwtAuthService(req: Request): JwtAuthServiceLike {
  const appLocals = req.app?.locals as
    | { jwtAuthService?: JwtAuthService | undefined }
    | undefined;
  if (!appLocals?.jwtAuthService) {
    throw new Error('JWT auth service unavailable');
  }
  return appLocals.jwtAuthService;
}

function unauthorized(req: Request, res: Response): void {
  if (req.path === '/api/login') {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (req.path.startsWith('/api') || req.path === '/events') {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.redirect('/login');
}

function parseBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (!authHeader) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) {
    return null;
  }

  return match[1];
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = parseBearerToken(req);
  if (!token) {
    unauthorized(req, res);
    return;
  }

  try {
    const jwtAuthService = getJwtAuthService(req);
    const identity = await jwtAuthService.verifyToken(token);
    (req as AuthenticatedRequest).authenticatedUser = {
      userId: identity.userId,
      email: identity.email,
      nickname: identity.nickname,
    };
    next();
  } catch {
    unauthorized(req, res);
  }
}

export function assignJwtAuthService(
  app: Express,
  jwtAuthService: JwtAuthService,
): void {
  (app.locals as { jwtAuthService?: JwtAuthService }).jwtAuthService =
    jwtAuthService;
}
