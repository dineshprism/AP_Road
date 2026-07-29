-- ============================================================
-- FULL DATABASE SCHEMA — Accident Reporting System
-- ============================================================

-- 1. ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');


-- 2. TABLES
-- ============================================================

-- 2a. profiles
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  full_name   text NOT NULL,
  district    text NOT NULL,
  designation text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2b. user_roles
CREATE TABLE public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role NOT NULL DEFAULT 'user'::app_role,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2c. accident_submissions
CREATE TABLE public.accident_submissions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL,
  district                  text NOT NULL,
  place_of_accident         text NOT NULL,
  mandal                    text NOT NULL,
  police_station            text NOT NULL,
  fir_number                text NOT NULL,
  road_type                 text NOT NULL,
  accident_date             date NOT NULL,
  accident_time             text NOT NULL,
  lat_long                  text,
  persons_died              integer NOT NULL DEFAULT 0,
  persons_injured           integer NOT NULL DEFAULT 0,
  vehicles                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  drivers                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  driver_related_causes     jsonb NOT NULL DEFAULT '{}'::jsonb,
  vehicle_condition_causes  jsonb NOT NULL DEFAULT '{}'::jsonb,
  road_engineering_nature   jsonb NOT NULL DEFAULT '{}'::jsonb,
  road_engineering_junctions jsonb NOT NULL DEFAULT '{}'::jsonb,
  road_engineering_signages jsonb NOT NULL DEFAULT '{}'::jsonb,
  road_engineering_median   jsonb NOT NULL DEFAULT '{}'::jsonb,
  road_engineering_culverts jsonb NOT NULL DEFAULT '{}'::jsonb,
  prepared_by_name          text,
  prepared_by_designation   text,
  prepared_by_date          date,
  verified_by_name          text,
  verified_by_designation   text,
  verified_by_date          date,
  approved_by_name          text,
  approved_by_designation   text,
  approved_by_date          date,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accident_submissions ENABLE ROW LEVEL SECURITY;


-- 3. FUNCTIONS
-- ============================================================

-- 3a. has_role — check if a user has a specific role (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3b. handle_new_user — auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- 3c. update_updated_at_column — auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- 4. TRIGGERS
-- ============================================================

-- Auto-assign role on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on accident_submissions
CREATE TRIGGER update_accident_submissions_updated_at
  BEFORE UPDATE ON public.accident_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- 5a. profiles
CREATE POLICY "Users can read own profile"    ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile"  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles"  ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 5b. user_roles
CREATE POLICY "Users can read own roles"      ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles"     ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 5c. accident_submissions
CREATE POLICY "Users can read own submissions"   ON public.accident_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own submissions" ON public.accident_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all submissions"  ON public.accident_submissions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
