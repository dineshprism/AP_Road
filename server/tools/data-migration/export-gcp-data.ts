import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  DATA_TABLES,
  DataBundle,
  ensureParentDir,
  getBooleanArg,
  getStringArg,
  getPublicTableNames,
  getTableColumns,
  parseArgs,
  quoteIdentifier,
  resolveUploadPath,
  tableExists,
  createPoolFromEnv,
} from "./common.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env"), override: false });

const args = parseArgs();
const outputFile = getStringArg(args, "out", path.resolve(process.cwd(), "migration-export", "road-accident-data.json"))!;
const includeUploads = getBooleanArg(args, "include-uploads");
const knownTablesOnly = getBooleanArg(args, "known-tables-only");
const uploadsRoot = path.resolve(getStringArg(args, "uploads-dir", path.resolve(process.cwd(), "uploads"))!);

const ORDER_BY: Partial<Record<(typeof DATA_TABLES)[number], string>> = {
  users: "created_at, id",
  user_roles: "user_id, role, id",
  profiles: "created_at, id",
  accident_submissions: "created_at, id",
  submission_rag_cache: "updated_at, submission_id",
  auth_activity_log: "created_at, id",
  feedback_messages: "created_at, id",
  cctns_hierarchy: "district_name, police_station_name, id",
};

async function main() {
  const pool = createPoolFromEnv(["SOURCE_", "GCP_"], { allowDefaultEnv: true });
  const client = await pool.connect();

  try {
    const databaseResult = await client.query<{ current_database: string }>("SELECT current_database()");
    const bundle: DataBundle = {
      bundleVersion: 1,
      exportedAt: new Date().toISOString(),
      source: {
        app: "road-accident-data-hub",
        database: databaseResult.rows[0]?.current_database,
      },
      tables: {},
    };

    const publicTables = knownTablesOnly ? [...DATA_TABLES] : await getPublicTableNames(client);
    const orderedTables = [
      ...DATA_TABLES.filter((table) => publicTables.includes(table)),
      ...publicTables.filter((table) => !DATA_TABLES.includes(table as (typeof DATA_TABLES)[number])),
    ];

    console.log(
      knownTablesOnly
        ? "Exporting known application tables only."
        : "Exporting every public table found in the source database."
    );

    for (const table of orderedTables) {
      if (!(await tableExists(client, table))) {
        console.warn(`Skipping missing table: ${table}`);
        continue;
      }

      const columns = await getTableColumns(client, table);
      const orderBy = ORDER_BY[table as (typeof DATA_TABLES)[number]] || columns[0] || "1";
      const result = await client.query<Record<string, unknown>>(
        `SELECT ${columns.map(quoteIdentifier).join(", ")}
         FROM ${quoteIdentifier(table)}
         ORDER BY ${orderBy}`
      );

      bundle.tables[table] = {
        columns,
        rows: result.rows,
      };

      console.log(`Exported ${result.rowCount} rows from ${table}`);
    }

    if (includeUploads) {
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
        const absolutePath = resolveUploadPath(uploadsRoot, relativePath);
        if (!fs.existsSync(absolutePath)) {
          console.warn(`Upload missing on disk, keeping DB path only: ${relativePath}`);
          continue;
        }

        const file = fs.readFileSync(absolutePath);
        bundle.uploads.push({
          relativePath,
          base64: file.toString("base64"),
          byteLength: file.byteLength,
        });
      }

      console.log(`Exported ${bundle.uploads.length} upload files from ${uploadsRoot}`);
    }

    ensureParentDir(outputFile);
    fs.writeFileSync(outputFile, JSON.stringify(bundle, null, 2));
    console.log(`\nExport complete: ${outputFile}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
