import { sign, verify } from 'jsonwebtoken';

export type JwtIdentity = {
  userId: string;
  email: string;
  nickname: string;
};

export type JwtIdentityInput = {
  id?: string;
  userId?: string;
  email?: string;
  nickname?: string;
};

export type JwtPayload = {
  userId?: string;
  id?: string;
  email?: string;
  nickname?: string;
  iat?: number;
  exp?: number;
};

export class JwtAuthService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtExpiresInSeconds: number,
  ) {}

  getExpiresInSeconds(): number {
    return this.jwtExpiresInSeconds;
  }

  async issueToken(identity: JwtIdentityInput): Promise<string> {
    const normalizedIdentity = this.normalizeIdentity(identity);
    return new Promise<string>((resolve, reject) => {
      sign(
        {
          userId: normalizedIdentity.userId,
          email: normalizedIdentity.email,
          nickname: normalizedIdentity.nickname,
        },
        this.jwtSecret,
        {
          algorithm: 'HS256',
          expiresIn: this.jwtExpiresInSeconds,
        },
        (error, token) => {
          if (error || !token) {
            reject(error || new Error('Failed to issue token'));
            return;
          }
          resolve(token);
        },
      );
    });
  }

  async verifyToken(token: string): Promise<JwtIdentity> {
    return new Promise<JwtIdentity>((resolve, reject) => {
      verify(token, this.jwtSecret, (error, decoded) => {
        if (error || !decoded) {
          reject(error || new Error('Invalid token'));
          return;
        }

        if (typeof decoded === 'string') {
          reject(new Error('Invalid token payload'));
          return;
        }

        const payload = decoded as JwtPayload;
        const identity = this.extractIdentityFromPayload(payload);
        if (!identity) {
          reject(new Error('Invalid token payload'));
          return;
        }

        resolve(identity);
      });
    });
  }

  private normalizeIdentity(identity: JwtIdentityInput): JwtIdentity {
    const userId = identity.userId ?? identity.id;
    if (!userId) {
      throw new Error('Identity requires userId');
    }
    if (!identity.email || !identity.nickname) {
      throw new Error('Identity requires email and nickname');
    }
    return {
      userId,
      email: identity.email,
      nickname: identity.nickname,
    };
  }

  private extractIdentityFromPayload(payload: JwtPayload): JwtIdentity | null {
    const userId = payload.userId ?? payload.id;
    const email = payload.email;
    const nickname = payload.nickname;

    if (!userId || !email || !nickname) {
      return null;
    }

    return {
      userId,
      email,
      nickname,
    };
  }
}
