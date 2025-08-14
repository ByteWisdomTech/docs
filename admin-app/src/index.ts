import express from 'express';
import session from 'express-session';
// @ts-ignore types not provided
import MemoryStoreFactory from 'memorystore';
import passport from 'passport';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import csrf from 'csurf';

import './lib/passport.js';
import authRoutes from './routes/auth.js';
import repoRoutes from './routes/repos.js';
import siteRoutes from './routes/site.js';
import rateLimit from 'express-rate-limit';
import { ensureDataDir } from './lib/fs.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
ensureDataDir();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],
      "img-src": ["'self'", 'data:'],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
      "form-action": ["'self'"],
      "upgrade-insecure-requests": []
    }
  },
}));

app.set('view engine', 'ejs');
const viewsCandidates = [
  path.join(__dirname, 'views'),
  path.join(__dirname, '..', 'src', 'views'),
];
const viewsPath = viewsCandidates.find(p => fs.existsSync(p)) || viewsCandidates[0];
app.set('views', viewsPath);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

const SQLiteStore = MemoryStoreFactory(session);
const sessionSecret = process.env.SESSION_SECRET || 'change_me_dev_only';

app.use(session({
  store: new (SQLiteStore as any)({ checkPeriod: 86400000 }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// CSRF after session
const csrfProtection = csrf();
app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.user = req.user;
  next();
});

app.get('/', (req, res) => {
  res.render('home');
});

app.use('/auth', authRoutes);
app.use('/repos', repoRoutes);
app.use('/site', siteRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send('Form tampered with');
  }
  res.status(500).send('Internal Server Error');
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Admin platform running on http://localhost:${port}`);
});
