import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    authenticatedUser?: {
      userId: string;
      email: string;
      nickname: string;
    };
  }
}
