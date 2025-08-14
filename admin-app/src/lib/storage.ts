import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type DBSchema = {
  users: Array<{ id: number; provider: string; providerId: string; username: string; displayName?: string; avatarUrl?: string; createdAt: string }>;
  tokens: Array<{ id: number; userId: number; provider: string; cipher: string; createdAt: string }>;
  sites: Array<{ id: number; userId: number; provider: string; owner: string; repo: string; defaultBranch: string; localPath: string; createdAt: string }>;
  seq: number;
};

const dbPath = path.join(__dirname, '..', '.data', 'db.json');
const adapter = new JSONFile<DBSchema>(dbPath);
const db = new Low<DBSchema>(adapter, { users: [], tokens: [], sites: [], seq: 1 });
await db.read();

function nextId() {
  const id = db.data!.seq++;
  return id;
}

export type User = { id: number; provider: string; providerId: string; username: string; displayName?: string; avatarUrl?: string };

export async function upsertUser(u: Omit<User, 'id'>): Promise<User> {
  const found = db.data!.users.find(x => x.provider === u.provider && x.providerId === u.providerId);
  if (found) {
    Object.assign(found, u);
  } else {
    db.data!.users.push({ id: nextId(), createdAt: new Date().toISOString(), ...u });
  }
  await db.write();
  const row = db.data!.users.find(x => x.provider === u.provider && x.providerId === u.providerId)!;
  const { createdAt, ...user } = row;
  return user;
}

export async function findUserById(id: number): Promise<User | undefined> {
  const row = db.data!.users.find(x => x.id === id);
  if (!row) return undefined;
  const { createdAt, ...u } = row;
  return u;
}

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is required');
  // derive 32 bytes
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptToken(plaintext: string) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

export function storeToken(userId: number, provider: string, accessToken: string) {
  const cipher = encryptToken(accessToken);
  db.data!.tokens.push({ id: nextId(), userId, provider, cipher, createdAt: new Date().toISOString() });
  return db.write();
}

export function getLatestToken(userId: number, provider: string): string | undefined {
  const rows = db.data!.tokens.filter(t => t.userId === userId && t.provider === provider);
  if (!rows.length) return undefined;
  const latest = rows[rows.length - 1];
  return decryptToken(latest.cipher);
}

export type Site = { id: number; userId: number; provider: string; owner: string; repo: string; defaultBranch: string; localPath: string };

export function upsertSite(site: Omit<Site, 'id'>): Site {
  const found = db.data!.sites.find(s => s.userId === site.userId && s.provider === site.provider && s.owner === site.owner && s.repo === site.repo);
  if (found) {
    Object.assign(found, site);
  } else {
    db.data!.sites.push({ id: nextId(), createdAt: new Date().toISOString(), ...site });
  }
  db.write();
  const row = db.data!.sites.find(s => s.userId === site.userId && s.provider === site.provider && s.owner === site.owner && s.repo === site.repo)!;
  const { createdAt, ...s } = row as any;
  return s;
}

export function listSites(userId: number): Site[] {
  return db.data!.sites.filter(s => s.userId === userId).map(({ createdAt, ...rest }) => rest);
}
