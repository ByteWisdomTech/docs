import { Router } from 'express';
import passport from 'passport';
import { storeToken } from '../lib/storage.js';

const router = Router();

router.get('/github', (req, res, next) => {
  const returnTo = (req.query.returnTo as string) || req.get('Referer') || '/repos';
  (req.session as any).returnTo = returnTo;
  return passport.authenticate('github', { scope: ['read:user', 'user:email', 'repo'] })(req, res, next);
});

router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', { failureRedirect: '/' }, (err: any, user: Express.User | false | null, info: any) => {
    if (err) {
      console.error('OAuth error:', err);
      return res.redirect('/?error=oauth');
    }
    if (!user) return res.redirect('/?error=denied');
    req.logIn(user, (loginErr?: any) => {
      if (loginErr) return next(loginErr);
      const token = info?.accessToken || (req.session as any)?.accessToken;
      if (token) storeToken((req.user as any).id, 'github', token);
      const returnTo = (req.session as any).returnTo || '/repos';
      delete (req.session as any).returnTo;
      return res.redirect(returnTo);
    });
  })(req, res, next);
});

router.post('/logout', (req, res, next) => {
  req.logout((err?: any) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

export default router;
