import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

function getPoolConfig(): pg.PoolConfig {
  const host = process.env.PGHOST || process.env.DB_HOST;
  const port = process.env.PGPORT || process.env.DB_PORT;
  const user = process.env.PGUSER || process.env.DB_USER;
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  const database = process.env.PGDATABASE || process.env.DB_NAME;

  // Prefer repo-local PG/DB settings over any machine-wide DATABASE_URL override.
  if (host || port || user || password || database) {
    return {
      host: host || "localhost",
      port: parseInt(port || "5432", 10),
      user: user || "postgres",
      password: password || "",
      database: database || "road_accident_db",
    };
  }

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
    };
  }

  return {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "",
    database: "road_accident_db",
  };
}

const pool = new pg.Pool(getPoolConfig());

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export default pool;
