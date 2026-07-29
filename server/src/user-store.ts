import { resolveUserTableName, findUserByEmailCandidates, UserTableName } from "./db/users.repo.js";

let cachedUserTable: UserTableName | null = null;

function normalizeLoginCandidates(username: string): string[] {
  const raw = username.trim();
  const lower = raw.toLowerCase();
  const normalized = lower.replace(/\s+/g, "_");
  const sanitized = lower
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return Array.from(new Set([raw, lower, normalized, sanitized].filter(Boolean)));
}

export async function resolveUserTable(): Promise<UserTableName> {
  if (cachedUserTable) {
    return cachedUserTable;
  }

  const userTable = await resolveUserTableName();
  if (!userTable) {
    throw new Error("No users table found. Expected public.users or auth.users.");
  }

  cachedUserTable = userTable;
  return cachedUserTable;
}

export async function findUserForLogin(username: string) {
  const userTable = await resolveUserTable();
  const candidates = normalizeLoginCandidates(username);

  return findUserByEmailCandidates(
    userTable,
    candidates,
    username.trim().toLowerCase(),
    username.trim().toLowerCase().replace(/\s+/g, "_")
  );
}
