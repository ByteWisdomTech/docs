import 'express-session';
import 'express';

declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      displayName?: string;
      avatarUrl?: string;
    }
  }
}
