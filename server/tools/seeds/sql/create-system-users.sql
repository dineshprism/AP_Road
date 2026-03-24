-- Create auth.users table for local development
CREATE SCHEMA IF NOT EXISTS auth;

-- Drop and recreate users table to avoid conflicts
DROP TABLE IF EXISTS auth.users CASCADE;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create users for all districts and admin roles
INSERT INTO auth.users (id, email, password_hash, created_at) VALUES 
-- District users
('visakhapatnam-user-id', 'visakhapatnam', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('vijayawada-user-id', 'krishna', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('guntur-user-id', 'guntur', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('chittoor-user-id', 'chittoor', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('anantapur-user-id', 'anantapur', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('kurnool-user-id', 'kurnool', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('nellore-user-id', 'nellore', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
-- Admin users
('dgp-user-id', 'dgp', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('adgp-user-id', 'adgp', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW());

-- Assign roles to users
INSERT INTO public.user_roles (id, user_id, role) VALUES 
(gen_random_uuid(), 'visakhapatnam-user-id', 'user'),
(gen_random_uuid(), 'vijayawada-user-id', 'user'),
(gen_random_uuid(), 'guntur-user-id', 'user'),
(gen_random_uuid(), 'chittoor-user-id', 'user'),
(gen_random_uuid(), 'anantapur-user-id', 'user'),
(gen_random_uuid(), 'kurnool-user-id', 'user'),
(gen_random_uuid(), 'nellore-user-id', 'user'),
(gen_random_uuid(), 'dgp-user-id', 'dgp'),
(gen_random_uuid(), 'adgp-user-id', 'adgp');

-- Create profiles for users
INSERT INTO public.profiles (id, user_id, full_name, district, designation) VALUES 
(gen_random_uuid(), 'visakhapatnam-user-id', 'R. Kumar', 'Visakhapatnam', 'Inspector'),
(gen_random_uuid(), 'vijayawada-user-id', 'B. Singh', 'Krishna', 'Inspector'),
(gen_random_uuid(), 'guntur-user-id', 'X. Murthy', 'Guntur', 'Inspector'),
(gen_random_uuid(), 'chittoor-user-id', 'I. Sharma', 'Chittoor', 'Inspector'),
(gen_random_uuid(), 'anantapur-user-id', 'N. Kumar', 'Anantapur', 'Inspector'),
(gen_random_uuid(), 'kurnool-user-id', 'S. Naidu', 'Kurnool', 'Inspector'),
(gen_random_uuid(), 'nellore-user-id', 'DD. Reddy', 'Nellore', 'Inspector'),
(gen_random_uuid(), 'dgp-user-id', 'DGP Officer', 'State HQ', 'Director General of Police'),
(gen_random_uuid(), 'adgp-user-id', 'ADGP Officer', 'State HQ', 'Additional Director General of Police');

-- Verify all data was created
SELECT 'Users created: ' || COUNT(*) FROM auth.users;
SELECT 'User roles created: ' || COUNT(*) FROM public.user_roles;
SELECT 'Profiles created: ' || COUNT(*) FROM public.profiles;
