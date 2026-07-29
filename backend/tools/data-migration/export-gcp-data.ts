import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { buildMigrationBundle } from "../../src/dataBundleExport.js";
import { ensureParentDir, getBooleanArg, getStringArg, parseArgs, createPoolFromEnv } from "./common.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env"), override: false });

const args = parseArgs();
const outputFile = getStringArg(args, "out", path.resolve(process.cwd(), "migration-export", "road-accident-data.json"))!;
const includeUploads = getBooleanArg(args, "include-uploads");
const uploadsRoot = path.resolve(getStringArg(args, "uploads-dir", path.resolve(process.cwd(), "uploads"))!);

async function main() {
  const pool = createPoolFromEnv(["SOURCE_", "GCP_"], { allowDefaultEnv: true });
  const client = await pool.connect();

  try {
    console.log("Exporting known application tables (submissions, users, signed copies, etc.).");
    const bundle = await buildMigrationBundle(client, { includeUploads, uploadsRoot });

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
