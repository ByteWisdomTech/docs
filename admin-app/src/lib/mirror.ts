import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { safeJoin } from './fs.js';

async function ensureDir(p: string) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeFileAtomic(filePath: string, content: Buffer | string) {
  const tmp = `${filePath}.tmp-${Date.now()}`;
  await fsp.writeFile(tmp, content);
  await fsp.rename(tmp, filePath);
}

export async function mirrorPath(octokit: Octokit, owner: string, repo: string, ref: string, repoPath: string, targetDir: string) {
  const res = await octokit.repos.getContent({ owner, repo, path: repoPath, ref });
  if (Array.isArray(res.data)) {
    // directory
    const dir = safeJoin(targetDir, repoPath);
    await ensureDir(dir);
    for (const item of res.data) {
      if (item.type === 'file') {
        const fileRes = await octokit.repos.getContent({ owner, repo, path: item.path!, ref });
        if (!Array.isArray(fileRes.data) && 'content' in fileRes.data) {
          const buf = Buffer.from(fileRes.data.content as string, 'base64');
          const filePath = safeJoin(targetDir, item.path!);
          await ensureDir(path.dirname(filePath));
          await writeFileAtomic(filePath, buf);
        }
      } else if (item.type === 'dir') {
        await mirrorPath(octokit, owner, repo, ref, item.path!, targetDir);
      }
    }
  } else {
    // file
    if ('content' in res.data) {
      const buf = Buffer.from(res.data.content as string, 'base64');
      const filePath = safeJoin(targetDir, repoPath);
      await ensureDir(path.dirname(filePath));
      await writeFileAtomic(filePath, buf);
    }
  }
}

export async function mirrorRepoSubset(octokit: Octokit, owner: string, repo: string, ref: string, targetDir: string, paths: string[]) {
  await ensureDir(targetDir);
  for (const p of paths) {
    try {
      await mirrorPath(octokit, owner, repo, ref, p, targetDir);
    } catch {
      // ignore missing path
    }
  }
}
