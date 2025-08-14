import { Router } from 'express';
import { getOctokitForUser, listDocusaurusRepos } from '../lib/github.js';
import { listSites, upsertSite } from '../lib/storage.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { mirrorRepoSubset } from '../lib/mirror.js';
import { ensureDataDir } from '../lib/fs.js';
import { ensureAuth } from '../lib/authz.js';

const router = Router();

router.get('/', ensureAuth, async (req: any, res) => {
  try {
    const octokit = getOctokitForUser(req.user);
    const repos = await listDocusaurusRepos(octokit);
    const sites = listSites(req.user.id);
    res.render('repos', { repos, sites });
  } catch (e) {
    // likely no token yet
    return res.redirect('/auth/github');
  }
});

router.post('/import', ensureAuth, async (req: any, res) => {
  const { owner, repo, default_branch } = req.body as { owner: string; repo: string; default_branch: string };
  // Mirror key paths locally for faster browsing and safe editing previews
  let octokit;
  try {
    octokit = getOctokitForUser(req.user);
  } catch {
    return res.redirect('/auth/github');
  }
  const baseDir = ensureDataDir();
  const localPath = path.join(baseDir, `u${req.user.id}-${owner}-${repo}`);
  await mirrorRepoSubset(octokit, owner, repo, default_branch, localPath, ['docs', 'blog', 'docusaurus.config.ts', 'docusaurus.config.js', 'sidebars.js', 'sidebars.ts']);
  const site = upsertSite({ userId: req.user.id, provider: 'github', owner, repo, defaultBranch: default_branch, localPath });
  res.redirect(`/site/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
});

export default router;
