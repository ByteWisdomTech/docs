import { Octokit } from '@octokit/rest';
import { getLatestToken, User } from './storage.js';

export function getOctokitForUser(user: User) {
  const token = getLatestToken(user.id, 'github');
  if (!token) throw new Error('Missing GitHub token');
  return new Octokit({ auth: token, userAgent: 'docusaurus-admin/0.1.0' });
}

export async function isDocusaurusRepo(octokit: Octokit, owner: string, repo: string): Promise<boolean> {
  try {
    // Check for docusaurus config files
    const cfgFiles = ['docusaurus.config.js', 'docusaurus.config.ts'];
    for (const f of cfgFiles) {
      try {
        await octokit.repos.getContent({ owner, repo, path: f });
        return true;
      } catch { /* ignore */ }
    }
    // Check package.json dependencies
    const pkg = await octokit.repos.getContent({ owner, repo, path: 'package.json' });
    if (!Array.isArray(pkg.data) && 'content' in pkg.data) {
      const content = Buffer.from(pkg.data.content as string, 'base64').toString('utf8');
      const json = JSON.parse(content) as any;
      const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
      return Object.keys(deps).some(k => k.startsWith('@docusaurus/'));
    }
    return false;
  } catch {
    return false;
  }
}

export async function listDocusaurusRepos(octokit: Octokit) {
  const repos: Array<{ owner: string; repo: string; default_branch: string; html_url: string } > = [];
  const iterator = octokit.paginate.iterator(octokit.repos.listForAuthenticatedUser, { per_page: 50, affiliation: 'owner,collaborator,organization_member' });
  for await (const { data } of iterator) {
    for (const r of data) {
      const ok = await isDocusaurusRepo(octokit, r.owner!.login, r.name);
      if (ok) {
        repos.push({ owner: r.owner!.login, repo: r.name, default_branch: r.default_branch!, html_url: r.html_url! });
      }
    }
  }
  return repos;
}

export async function getFile(octokit: Octokit, owner: string, repo: string, path: string, ref?: string) {
  const res = await octokit.repos.getContent({ owner, repo, path, ref });
  if (Array.isArray(res.data) || !('content' in res.data)) throw new Error('Not a file');
  const content = Buffer.from(res.data.content as string, 'base64').toString('utf8');
  return { sha: res.data.sha!, content };
}

export async function putFileAndPR(octokit: Octokit, params: {
  owner: string; repo: string; path: string; message: string; content: string; baseBranch: string;
}) {
  const branchName = `admin-edit-${Date.now()}`;
  // Get base branch sha
  const baseRef = await octokit.git.getRef({ owner: params.owner, repo: params.repo, ref: `heads/${params.baseBranch}` });
  const baseSha = baseRef.data.object.sha;
  // Create new branch
  await octokit.git.createRef({ owner: params.owner, repo: params.repo, ref: `refs/heads/${branchName}`, sha: baseSha });
  // Get existing file sha if exists
  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({ owner: params.owner, repo: params.repo, path: params.path, ref: params.baseBranch });
    if (!Array.isArray(existing.data) && 'sha' in existing.data) sha = existing.data.sha as string;
  } catch {/* new file */}
  // Update file on new branch
  const b64 = Buffer.from(params.content, 'utf8').toString('base64');
  await octokit.repos.createOrUpdateFileContents({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    message: params.message,
    content: b64,
    branch: branchName,
    sha,
  });
  // Create PR
  const pr = await octokit.pulls.create({
    owner: params.owner,
    repo: params.repo,
    head: branchName,
    base: params.baseBranch,
    title: params.message,
  });
  return pr.data.html_url;
}
