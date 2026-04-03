import pool from "./db.js";
import { fileURLToPath } from "url";

export const migration = `
-- =============================================
-- Road Accident Data Hub — PostgreSQL Schema
-- =============================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Role enum
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user', 'dgp', 'adgp');
EXCEPTION
  WHEN duplicate_object THEN
    -- Add new roles if enum exists but doesn't have them
    BEGIN ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'dgp'; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'adgp'; EXCEPTION WHEN others THEN NULL; END;
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

export async function runMigrations(options?: { closePool?: boolean }) {
  console.log("Running database migration...");
  try {
    await pool.query(migration);
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
