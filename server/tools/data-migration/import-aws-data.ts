import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { migration } from "../../src/migrate.js";
import {
  DATA_TABLES,
  DataBundle,
  createPoolFromEnv,
  getBooleanArg,
  getStringArg,
  getTableColumns,
  parseArgs,
  quoteIdentifier,
  resolveUploadPath,
  tableExists,
} from "./common.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env"), override: false });

const args = parseArgs();
const inputFile = getStringArg(args, "file", path.resolve(process.cwd(), "migration-export", "road-accident-data.json"))!;
const replaceExisting = getBooleanArg(args, "replace");
const restoreUploads = getBooleanArg(args, "restore-uploads");
const allowDefaultEnv = getBooleanArg(args, "use-default-env");
const uploadsRoot = path.resolve(getStringArg(args, "uploads-dir", path.resolve(process.cwd(), "uploads"))!);

function getOrderedBundleTables(bundle: DataBundle) {
  const bundledTables = Object.keys(bundle.tables);
  return [
    ...DATA_TABLES.filter((table) => bundledTables.includes(table)),
    ...bundledTables.filter((table) => !DATA_TABLES.includes(table as (typeof DATA_TABLES)[number])).sort(),
  ];
}

async function getPrimaryKeyColumns(client: import("pg").PoolClient, tableName: string) {
  const result = await client.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
     WHERE tc.table_schema = 'public'
       AND tc.table_name = $1
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

async function insertRows(
  client: import("pg").PoolClient,
  tableName: string,
  bundleColumns: string[],
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return 0;

  const targetColumns = await getTableColumns(client, tableName);
  const columns = bundleColumns.filter((column) => targetColumns.includes(column));
  if (columns.length === 0) {
    console.warn(`Skipping ${tableName}: no matching target columns`);
    return 0;
  }

  const primaryKeyColumns = await getPrimaryKeyColumns(client, tableName);
  const updatableColumns = columns.filter((column) => !primaryKeyColumns.includes(column));
  const quotedColumns = columns.map(quoteIdentifier).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const conflictSql =
    primaryKeyColumns.length === 0
      ? ""
      : updatableColumns.length === 0
        ? ` ON CONFLICT (${primaryKeyColumns.map(quoteIdentifier).join(", ")}) DO NOTHING`
        : ` ON CONFLICT (${primaryKeyColumns.map(quoteIdentifier).join(", ")}) DO UPDATE SET ${updatableColumns
            .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
            .join(", ")}`;

  const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns}) VALUES (${placeholders})${conflictSql}`;

  for (const row of rows) {
    await client.query(
      sql,
      columns.map((column) => row[column] ?? null)
    );
  }

  return rows.length;
}

async function restoreUploadFiles(bundle: DataBundle) {
  if (!bundle.uploads?.length) {
    console.log("No upload files found in bundle.");
    return;
  }

  for (const upload of bundle.uploads) {
    const absolutePath = resolveUploadPath(uploadsRoot, upload.relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const buffer = Buffer.from(upload.base64, "base64");
    fs.writeFileSync(absolutePath, buffer);

    if (buffer.byteLength !== upload.byteLength) {
      console.warn(
        `Restored ${upload.relativePath}, but byte count differs: expected ${upload.byteLength}, wrote ${buffer.byteLength}`
      );
    }
  }

  console.log(`Restored ${bundle.uploads.length} upload files into ${uploadsRoot}`);
}

async function main() {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Migration bundle not found: ${inputFile}`);
  }

  const bundle = JSON.parse(fs.readFileSync(inputFile, "utf8")) as DataBundle;
  if (bundle.bundleVersion !== 1 || bundle.source?.app !== "road-accident-data-hub") {
    throw new Error("This file does not look like a Road Accident Data Hub migration bundle.");
  }

  const pool = createPoolFromEnv(["TARGET_", "AWS_"], { allowDefaultEnv });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(migration);

    const orderedTables = getOrderedBundleTables(bundle);

    if (replaceExisting) {
      const existingTables = [];
      for (const table of orderedTables) {
        if (await tableExists(client, table)) {
          existingTables.push(table);
        }
      }

      if (existingTables.length > 0) {
        await client.query(
          `TRUNCATE ${existingTables.map(quoteIdentifier).join(", ")} RESTART IDENTITY CASCADE`
        );
        console.log(`Cleared existing rows from ${existingTables.length} target tables`);
      }
    }

    for (const table of orderedTables) {
      const tableDump = bundle.tables[table];
      if (!tableDump) continue;

      if (!(await tableExists(client, table))) {
        console.warn(`Skipping ${table}: target table does not exist`);
        continue;
      }

      const inserted = await insertRows(client, table, tableDump.columns, tableDump.rows);
      console.log(`Imported ${inserted} rows into ${table}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  if (restoreUploads) {
    await restoreUploadFiles(bundle);
  }

  console.log(`\nImport complete from ${inputFile}`);
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
