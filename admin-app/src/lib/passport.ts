import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import dotenv from 'dotenv';
import { upsertUser, findUserById, User } from './storage.js';

dotenv.config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback';

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
}

passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: CALLBACK_URL,
  scope: ['read:user', 'user:email', 'repo'],
  state: true,
  passReqToCallback: true,
}, async (req: any, accessToken: string, _refreshToken: string, profile: any, done: (err: any, user?: any, info?: any) => void) => {
  try {
    const user = await upsertUser({
      provider: 'github',
      providerId: profile.id,
      username: profile.username || profile.displayName || 'unknown',
      displayName: profile.displayName || profile.username || 'unknown',
      avatarUrl: profile.photos?.[0]?.value,
    });
    // temporarily stash token in session, route will store it
    if (req && req.session) {
      req.session.accessToken = accessToken as string;
    }
  done(null, user, { accessToken });
  } catch (e) {
    done(e as any);
  }
}));

passport.serializeUser(((user: any, done: (err: any, id?: number) => void) => {
  done(null, (user as User).id);
}) as any);

passport.deserializeUser(async (id: number, done: (err: any, user?: User | false) => void) => {
  try {
    const user = await findUserById(id);
    done(null, user);
  } catch (e) {
    done(e as any);
  }
});

export default passport;
