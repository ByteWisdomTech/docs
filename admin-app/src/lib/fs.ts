import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', '.data');

export function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

export function safeJoin(base: string, target: string) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Path traversal attempt');
  return resolved;
}
