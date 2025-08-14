import { Request, Response, NextFunction } from 'express';

export function ensureAuth(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore passport types
  if ((req as any).isAuthenticated && (req as any).isAuthenticated()) return next();
  const here = req.originalUrl || '/repos';
  const isAuthRoute = here.startsWith('/auth/');
  const target = isAuthRoute ? '/auth/github' : `/auth/github?returnTo=${encodeURIComponent(here)}`;
  res.redirect(target);
}
