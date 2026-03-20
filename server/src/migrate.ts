import pool from "./db.js";

const migration = `
-- =============================================
-- Road Accident Data Hub — PostgreSQL Schema
-- =============================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Role enum
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
`;

async function migrate() {
  console.log("Running database migration...");
  try {
    await pool.query(migration);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
