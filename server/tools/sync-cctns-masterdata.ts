import fs from "fs";
import path from "path";
import pool from "../src/db.js";
import { runMigrations } from "../src/migrate.js";

type CsvRecord = {
  DISTRICT_CD: string;
  DISTRICT: string;
  SDPO_CD: string;
  SDPO: string;
  CIRCLE_CD: string;
  CIRCLE: string;
  PS_CD: string;
  PS: string;
};

function parseCsv(filePath: string): CsvRecord[] {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          currentField += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    if (ch === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += ch;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  const [header = [], ...dataRows] = rows;

  return dataRows
    .filter((row) => row.some((value) => String(value || "").trim() !== ""))
    .map((row) => {
      const mapped = Object.fromEntries(
        header.map((column, index) => [column, row[index] ?? ""])
      ) as CsvRecord;

      return mapped;
    });
}

function normalizeCode(value: string): string | null {
  const normalized = String(value || "").trim();
  return normalized === "" || normalized === "0" ? null : normalized;
}

function normalizeName(value: string): string | null {
  const normalized = String(value || "").trim();
  return normalized === "" || normalized === "-" ? null : normalized;
}

async function main() {
  await runMigrations();

  const csvPath = path.resolve(process.cwd(), "..", "CCTNS-Masterdata.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const records = parseCsv(csvPath);

  await pool.query("BEGIN");

  try {
    await pool.query("TRUNCATE TABLE cctns_hierarchy RESTART IDENTITY");

    const insertSql = `
      INSERT INTO cctns_hierarchy (
        district_code,
        district_name,
        sdpo_code,
        sdpo_name,
        circle_code,
        circle_name,
        police_station_code,
        police_station_name,
        source_file
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    for (const record of records) {
      await pool.query(insertSql, [
        normalizeCode(record.DISTRICT_CD),
        String(record.DISTRICT || "").trim(),
        normalizeCode(record.SDPO_CD),
        normalizeName(record.SDPO),
        normalizeCode(record.CIRCLE_CD),
        normalizeName(record.CIRCLE),
        String(record.PS_CD || "").trim(),
        String(record.PS || "").trim(),
        path.basename(csvPath),
      ]);
    }

    await pool.query("COMMIT");

    const countsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_rows,
        COUNT(DISTINCT district_name) AS districts,
        COUNT(DISTINCT sdpo_name) AS sdpos,
        COUNT(DISTINCT circle_name) AS circles,
        COUNT(DISTINCT police_station_name) AS police_stations
      FROM cctns_hierarchy
    `);

    console.log(JSON.stringify({
      csvPath,
      importedRows: records.length,
      counts: countsResult.rows[0],
    }, null, 2));
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
