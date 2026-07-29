import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
];

// Server .env wins over parent .env and pre-set shell vars for local DB settings.
for (let index = 0; index < envCandidates.length; index += 1) {
  const envPath = envCandidates[index];
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: index === 0 });
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

const poolConfig = getPoolConfig();

if (process.env.NODE_ENV === "production") {
  const hasDbCredentials = Boolean(
    process.env.DATABASE_URL ||
      process.env.PGPASSWORD ||
      process.env.DB_PASSWORD ||
      ("password" in poolConfig && poolConfig.password)
  );
  if (!hasDbCredentials) {
    console.error("FATAL: Database credentials are required in production.");
    process.exit(1);
  }
}

const pool = new pg.Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export default pool;
