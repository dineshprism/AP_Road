import pool from "./db.js";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";

export const migration = `
-- =============================================
-- Road Accident Data Hub — PostgreSQL Schema
-- =============================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Role enum
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user', 'dgp', 'adgp', 'prism');
EXCEPTION
  WHEN duplicate_object THEN
    -- Add new roles if enum exists but doesn't have them
    BEGIN ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'dgp'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'adgp'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'prism'; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- Users table (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    district TEXT NOT NULL,
    designation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Main accident submissions table (column order matches database-schema.sql)
CREATE TABLE IF NOT EXISTS accident_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    district TEXT NOT NULL,
    place_of_accident TEXT NOT NULL,
    mandal TEXT NOT NULL,
    police_station TEXT NOT NULL,
    fir_number TEXT NOT NULL,
    road_type TEXT NOT NULL,
    accident_date DATE NOT NULL,
    accident_time TEXT NOT NULL,
    lat_long TEXT,
    persons_died INTEGER NOT NULL DEFAULT 0,
    persons_injured INTEGER NOT NULL DEFAULT 0,
    victim_details JSONB NOT NULL DEFAULT '[]',
    vehicles JSONB NOT NULL DEFAULT '[]',
    drivers JSONB NOT NULL DEFAULT '[]',
    driver_related_causes JSONB NOT NULL DEFAULT '{}',
    vehicle_condition_causes JSONB NOT NULL DEFAULT '{}',
    road_engineering_nature JSONB NOT NULL DEFAULT '{}',
    road_engineering_junctions JSONB NOT NULL DEFAULT '{}',
    road_engineering_signages JSONB NOT NULL DEFAULT '{}',
    road_engineering_median JSONB NOT NULL DEFAULT '{}',
    road_engineering_culverts JSONB NOT NULL DEFAULT '{}',
    prepared_by_name TEXT,
    prepared_by_designation TEXT,
    prepared_by_date DATE,
    verified_by_name TEXT,
    verified_by_designation TEXT,
    verified_by_date DATE,
    approved_by_name TEXT,
    approved_by_designation TEXT,
    approved_by_date DATE,
    signed_copy_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
    signed_copy_name TEXT,
    signed_copy_path TEXT,
    signed_copy_uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accident_submissions ADD COLUMN IF NOT EXISTS signed_copy_uploaded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE accident_submissions ADD COLUMN IF NOT EXISTS signed_copy_name TEXT;
ALTER TABLE accident_submissions ADD COLUMN IF NOT EXISTS signed_copy_path TEXT;
ALTER TABLE accident_submissions ADD COLUMN IF NOT EXISTS signed_copy_uploaded_at TIMESTAMPTZ;
ALTER TABLE accident_submissions ADD COLUMN IF NOT EXISTS victim_details JSONB NOT NULL DEFAULT '[]';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_accident_submissions_updated_at ON accident_submissions;
CREATE TRIGGER update_accident_submissions_updated_at
  BEFORE UPDATE ON accident_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_district ON accident_submissions(district);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON accident_submissions(accident_date);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON accident_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

CREATE TABLE IF NOT EXISTS submission_rag_cache (
    submission_id UUID PRIMARY KEY REFERENCES accident_submissions(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_rag_cache_updated_at ON submission_rag_cache(updated_at);

CREATE TABLE IF NOT EXISTS auth_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_activity_log_user_id ON auth_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_activity_log_created_at ON auth_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_activity_log_event_type ON auth_activity_log(event_type);

CREATE TABLE IF NOT EXISTS feedback_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    district TEXT NOT NULL,
    full_name TEXT,
    designation TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at ON feedback_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_district ON feedback_messages(district);

CREATE TABLE IF NOT EXISTS cctns_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_code TEXT,
    district_name TEXT NOT NULL,
    sdpo_code TEXT,
    sdpo_name TEXT,
    circle_code TEXT,
    circle_name TEXT,
    police_station_code TEXT NOT NULL,
    police_station_name TEXT NOT NULL,
    source_file TEXT NOT NULL DEFAULT 'CCTNS-Masterdata.csv',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (police_station_code)
);

CREATE INDEX IF NOT EXISTS idx_cctns_hierarchy_district_name ON cctns_hierarchy(district_name);
CREATE INDEX IF NOT EXISTS idx_cctns_hierarchy_sdpo_name ON cctns_hierarchy(sdpo_name);
CREATE INDEX IF NOT EXISTS idx_cctns_hierarchy_circle_name ON cctns_hierarchy(circle_name);
CREATE INDEX IF NOT EXISTS idx_cctns_hierarchy_police_station_name ON cctns_hierarchy(police_station_name);

DROP TRIGGER IF EXISTS update_cctns_hierarchy_updated_at ON cctns_hierarchy;
CREATE TRIGGER update_cctns_hierarchy_updated_at
  BEFORE UPDATE ON cctns_hierarchy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function getDistrictShortcut(district: string) {
  const normalized = district.trim();
  const knownShortcuts: Record<string, string> = {
    "YSR Kadapa": "YSRK",
    "Sri Potti Sriramulu Nellore": "SPSN",
    "Alluri Sitharama Raju": "ASR",
    "Dr. B.R. Ambedkar Konaseema": "BRAK",
    "NTR": "NTR",
  };

  if (knownShortcuts[normalized]) {
    return knownShortcuts[normalized];
  }

  const words = normalized
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 1) {
    return sanitizeFilePart(words[0] || "DIST").slice(0, 5).toUpperCase() || "DIST";
  }

  return words.map((word) => word[0]).join("").slice(0, 5).toUpperCase();
}

function getSignedCopyFileName(district: string, firNumber: string, currentPath: string | null, rowId: string) {
  const districtShortcut = getDistrictShortcut(district);
  const firPart = sanitizeFilePart(firNumber) || "FIR";
  const currentExt = currentPath ? path.extname(currentPath).toLowerCase() : "";
  const allowedExt = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
  const extension = allowedExt.has(currentExt) ? currentExt : ".pdf";
  const baseName = `${districtShortcut}_${firPart}${extension}`;
  const uploadsDir = path.resolve(process.cwd(), "uploads", "signed-copies");
  const targetPath = path.join(uploadsDir, baseName);

  if (!fs.existsSync(targetPath) || currentPath?.endsWith(baseName)) {
    return baseName;
  }

  return `${districtShortcut}_${firPart}_${rowId.slice(0, 8)}${extension}`;
}

async function renameExistingSignedCopies() {
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const signedCopiesDir = path.join(uploadsRoot, "signed-copies");

  if (!fs.existsSync(signedCopiesDir)) {
    fs.mkdirSync(signedCopiesDir, { recursive: true });
  }

  const result = await pool.query<{
    id: string;
    district: string;
    fir_number: string;
    signed_copy_name: string | null;
    signed_copy_path: string | null;
  }>(`
    SELECT id, district, fir_number, signed_copy_name, signed_copy_path
    FROM accident_submissions
    WHERE signed_copy_uploaded = TRUE
      AND signed_copy_path IS NOT NULL
  `);

  let renamedCount = 0;

  for (const row of result.rows) {
    if (!row.signed_copy_path) continue;

    const nextFileName = getSignedCopyFileName(row.district, row.fir_number, row.signed_copy_path, row.id);
    const nextRelativePath = path.posix.join("signed-copies", nextFileName);

    if (row.signed_copy_name === nextFileName && row.signed_copy_path === nextRelativePath) {
      continue;
    }

    const currentAbsolutePath = path.resolve(uploadsRoot, row.signed_copy_path);
    const nextAbsolutePath = path.join(signedCopiesDir, nextFileName);

    if (fs.existsSync(currentAbsolutePath) && currentAbsolutePath !== nextAbsolutePath) {
      if (fs.existsSync(nextAbsolutePath)) {
        fs.unlinkSync(nextAbsolutePath);
      }
      fs.renameSync(currentAbsolutePath, nextAbsolutePath);
    }

    await pool.query(
      `
        UPDATE accident_submissions
        SET signed_copy_name = $1,
            signed_copy_path = $2
        WHERE id = $3
      `,
      [nextFileName, nextRelativePath, row.id]
    );
    renamedCount += 1;
  }

  if (renamedCount > 0) {
    console.log(`Renamed ${renamedCount} existing signed copy file reference(s).`);
  }
}

export async function runMigrations(options?: { closePool?: boolean }) {
  console.log("Running database migration...");
  try {
    await pool.query(migration);
    await pool.query(`
      INSERT INTO user_roles (user_id, role)
      SELECT p.user_id, 'prism'::app_role
      FROM profiles p
      WHERE lower(p.district) = 'prism'
      ON CONFLICT (user_id, role) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO user_roles (user_id, role)
      SELECT p.user_id, 'admin'::app_role
      FROM profiles p
      WHERE lower(p.district) = 'prism'
      ON CONFLICT (user_id, role) DO NOTHING
    `);
    await renameExistingSignedCopies();
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    if (options?.closePool) {
      await pool.end();
    }
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runMigrations({ closePool: true }).catch(() => {
    process.exit(1);
  });
}
