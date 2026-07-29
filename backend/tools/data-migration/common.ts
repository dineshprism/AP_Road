import fs from "fs";
import path from "path";
import pg from "pg";

export const DATA_TABLES = [
  "users",
  "user_roles",
  "profiles",
  "accident_submissions",
  "submission_rag_cache",
  "auth_activity_log",
  "feedback_messages",
  "cctns_hierarchy",
] as const;

export type DataTable = (typeof DATA_TABLES)[number];

export interface TableDump {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface UploadDump {
  relativePath: string;
  base64: string;
  byteLength: number;
}

export interface DataBundle {
  bundleVersion: 1;
  exportedAt: string;
  source: {
    app: "road-accident-data-hub";
    database?: string;
  };
  tables: Record<string, TableDump>;
  uploads?: UploadDump[];
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map<string, string | boolean>();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;

    const [rawKey, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args.set(rawKey, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(rawKey, next);
      index += 1;
    } else {
      args.set(rawKey, true);
    }
  }

  return args;
}

export function getStringArg(args: Map<string, string | boolean>, key: string, fallback?: string) {
  const value = args.get(key);
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function getBooleanArg(args: Map<string, string | boolean>, key: string) {
  return args.get(key) === true || args.get(key) === "true";
}

export function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

export function createPoolFromEnv(prefixes: string[], options?: { allowDefaultEnv?: boolean }) {
  for (const prefix of prefixes) {
    const url = process.env[`${prefix}DATABASE_URL`];
    if (url) {
      return new pg.Pool({ connectionString: url });
    }

    const host = process.env[`${prefix}PGHOST`] || process.env[`${prefix}DB_HOST`];
    const port = process.env[`${prefix}PGPORT`] || process.env[`${prefix}DB_PORT`];
    const user = process.env[`${prefix}PGUSER`] || process.env[`${prefix}DB_USER`];
    const password = process.env[`${prefix}PGPASSWORD`] || process.env[`${prefix}DB_PASSWORD`];
    const database = process.env[`${prefix}PGDATABASE`] || process.env[`${prefix}DB_NAME`];

    if (host || port || user || password || database) {
      return new pg.Pool({
        host: host || "localhost",
        port: Number(port || 5432),
        user: user || "postgres",
        password: password || "",
        database: database || "road_accident_db",
      });
    }
  }

  if (options?.allowDefaultEnv) {
    if (process.env.DATABASE_URL) {
      return new pg.Pool({ connectionString: process.env.DATABASE_URL });
    }

    return new pg.Pool({
      host: process.env.PGHOST || process.env.DB_HOST || "localhost",
      port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
      user: process.env.PGUSER || process.env.DB_USER || "postgres",
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || "",
      database: process.env.PGDATABASE || process.env.DB_NAME || "road_accident_db",
    });
  }

  throw new Error(
    `Missing database connection. Set ${prefixes
      .map((prefix) => `${prefix}DATABASE_URL or ${prefix}PGHOST/${prefix}PGDATABASE`)
      .join(", ")}.`
  );
}

export async function tableExists(client: pg.PoolClient, tableName: string) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS exists`,
    [tableName]
  );

  return result.rows[0]?.exists === true;
}

export async function getPublicTableNames(client: pg.PoolClient) {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  return result.rows.map((row) => row.table_name);
}

export async function getTableColumns(client: pg.PoolClient, tableName: string) {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

export function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function resolveUploadPath(uploadsRoot: string, relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absoluteRoot = path.resolve(uploadsRoot);
  const absolutePath = path.resolve(absoluteRoot, normalized);

  if (!absolutePath.startsWith(absoluteRoot + path.sep) && absolutePath !== absoluteRoot) {
    throw new Error(`Refusing to access upload outside root: ${relativePath}`);
  }

  return absolutePath;
}
