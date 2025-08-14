import { Router } from 'express';
import { getOctokitForUser, getFile, putFileAndPR } from '../lib/github.js';
import { ensureAuth } from '../lib/authz.js';

const router = Router();

router.get('/:owner/:repo', ensureAuth, async (req: any, res) => {
  const { owner, repo } = req.params;
  res.render('site', { owner, repo });
});

router.get('/:owner/:repo/edit', ensureAuth, async (req: any, res) => {
  const { owner, repo } = req.params;
  const { path = 'docs/intro.md', ref } = req.query as any;
  let octokit;
  try { octokit = getOctokitForUser(req.user); } catch { return res.redirect('/auth/github'); }
  try {
    const file = await getFile(octokit, owner, repo, path, ref);
    res.render('edit', { owner, repo, path, content: file.content });
  } catch (e: any) {
    res.status(404).send(e.message || 'File not found');
  }
});

router.post('/:owner/:repo/edit', ensureAuth, async (req: any, res) => {
  const { owner, repo } = req.params;
  const { path, content, message, baseBranch } = req.body as any;
  let octokit;
  try { octokit = getOctokitForUser(req.user); } catch { return res.redirect('/auth/github'); }
  try {
    const prUrl = await putFileAndPR(octokit, { owner, repo, path, content, message: message || `Edit ${path}`, baseBranch: baseBranch || 'main' });
    res.render('saved', { prUrl });
  } catch (e: any) {
    res.status(500).send(e.message || 'Failed to save');
  }
});

export default router;
