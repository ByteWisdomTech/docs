# Docusaurus Admin Platform (Minimal Prototype)

A minimal multi-tenant admin app to manage Docusaurus sites stored on GitHub.

Features:
- GitHub OAuth login
- List only repositories that contain a Docusaurus site
- Import a site and edit docs files in a clean web UI
- Save changes as PRs back to GitHub (no direct pushes)
- Secure defaults: helmet, CSRF, httpOnly cookies, session store

## Setup

1. Copy `.env.example` to `.env` and fill in values:

- Create a GitHub OAuth app, set callback URL to `http://localhost:4000/auth/github/callback`
- Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- Set a strong `SESSION_SECRET`

2. Install dependencies and run:

```powershell
# from admin-app
npm install
npm run dev
```

Open http://localhost:4000

## Notes
- This prototype edits files via PRs. A background worker and local clone can be added later for preview builds.
- Multi-tenant: each user has isolated session and token storage; site records are keyed per-user.
- Add RBAC and organization mapping as needed.
