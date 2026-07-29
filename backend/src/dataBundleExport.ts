import fs from "fs";
import path from "path";
import type pg from "pg";

export const DATA_TABLES = [
  "users",
  "user_roles",
  "profiles",
  "accident_submissions",
  "auth_activity_log",
  "feedback_messages",
  "cctns_hierarchy",
] as const;

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
    environment?: string;
  };
  restore?: {
    description: string;
    importCommand: string;
  };
  /** Every click exports the entire DB — no date range, no incremental slice */
  exportScope: {
    type: "full";
    description: string;
  };
  tables: Record<string, TableDump>;
  uploads?: UploadDump[];
}

const ORDER_BY: Partial<Record<(typeof DATA_TABLES)[number], string>> = {
  users: "created_at, id",
  user_roles: "user_id, role, id",
  profiles: "created_at, id",
  accident_submissions: "created_at, id",
  auth_activity_log: "created_at, id",
  feedback_messages: "created_at, id",
  cctns_hierarchy: "district_name, police_station_name, id",
};

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function resolveUploadPath(uploadsRoot: string, relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absoluteRoot = path.resolve(uploadsRoot);
  const absolutePath = path.resolve(absoluteRoot, normalized);

  if (!absolutePath.startsWith(absoluteRoot + path.sep) && absolutePath !== absoluteRoot) {
    throw new Error(`Refusing to access upload outside root: ${relativePath}`);
  }

  return absolutePath;
}

async function tableExists(client: pg.PoolClient, tableName: string) {
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

async function getTableColumns(client: pg.PoolClient, tableName: string) {
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

export interface BuildBundleOptions {
  includeUploads: boolean;
  uploadsRoot: string;
}

export async function buildMigrationBundle(
  client: pg.PoolClient,
  options: BuildBundleOptions
): Promise<DataBundle> {
  const databaseResult = await client.query<{ current_database: string }>("SELECT current_database()");
  const bundle: DataBundle = {
    bundleVersion: 1,
    exportedAt: new Date().toISOString(),
    source: {
      app: "road-accident-data-hub",
      database: databaseResult.rows[0]?.current_database,
      environment: process.env.NODE_ENV || "development",
    },
    restore: {
      description:
        "Seed-ready bundle. Import with data:import:aws using --replace and --restore-uploads on the target server.",
      importCommand:
        "cd server && npm run data:import:aws -- --file ./road-accident-backup.json --replace --restore-uploads --use-default-env --uploads-dir ./uploads",
    },
    exportScope: {
      type: "full",
      description:
        "Complete export of all portal data from the first record through the export timestamp. Not incremental — every download is a full snapshot.",
    },
    tables: {},
  };

  for (const table of DATA_TABLES) {
    if (!(await tableExists(client, table))) {
      console.warn(`[backup] Skipping missing table: ${table}`);
      continue;
    }

    const columns = await getTableColumns(client, table);
    const orderBy = ORDER_BY[table] || columns[0] || "1";
    const result = await client.query<Record<string, unknown>>(
      `SELECT ${columns.map(quoteIdentifier).join(", ")}
       FROM ${quoteIdentifier(table)}
       ORDER BY ${orderBy}`
    );

    bundle.tables[table] = {
      columns,
      rows: result.rows,
    };

    console.log(`[backup] Exported ${result.rowCount} rows from ${table}`);
  }

  if (options.includeUploads) {
    const signedCopyPaths = new Set<string>();
    const submissions = bundle.tables.accident_submissions?.rows || [];

    for (const row of submissions) {
      const signedCopyPath = row.signed_copy_path;
      if (typeof signedCopyPath === "string" && signedCopyPath.trim()) {
        signedCopyPaths.add(signedCopyPath.trim());
      }
    }

    bundle.uploads = [];
    for (const relativePath of signedCopyPaths) {
      const absolutePath = resolveUploadPath(options.uploadsRoot, relativePath);
      if (!fs.existsSync(absolutePath)) {
        console.warn(`[backup] Upload missing on disk: ${relativePath}`);
        continue;
      }

      const file = fs.readFileSync(absolutePath);
      bundle.uploads.push({
        relativePath,
        base64: file.toString("base64"),
        byteLength: file.byteLength,
      });
    }

    console.log(`[backup] Embedded ${bundle.uploads.length} signed-copy files`);
  }

  return bundle;
}
