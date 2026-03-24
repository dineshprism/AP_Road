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

-- Sample users for testing accident data
INSERT INTO auth.users (id, email, password_hash, created_at) VALUES 
('2ded8a9b-d495-43b6-9548-7dc9158059ff', 'visakha.officer1@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('3ded8a9b-d495-43b6-9548-7dc9158059ff', 'visakha.officer2@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('4ded8a9b-d495-43b6-9548-7dc9158059ff', 'krishna.officer1@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('5ded8a9b-d495-43b6-9548-7dc9158059ff', 'krishna.officer2@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('6ded8a9b-d495-43b6-9548-7dc9158059ff', 'chittoor.officer@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('7ded8a9b-d495-43b6-9548-7dc9158059ff', 'anantapur.officer@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('8ded8a9b-d495-43b6-9548-7dc9158059ff', 'kurnool.officer@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('9ded8a9b-d495-43b6-9548-7dc9158059ff', 'guntur.admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW());

-- Verify users were created
SELECT 'Users created: ' || COUNT(*) FROM auth.users;

-- Assign roles to users
INSERT INTO public.user_roles (id, user_id, role) VALUES 
(gen_random_uuid(), '2ded8a9b-d495-43b6-9548-7dc9158059ff', 'user'),
(gen_random_uuid(), '3ded8a9b-d495-43b6-9548-7dc9158059ff', 'user'),
(gen_random_uuid(), '4ded8a9b-d495-43b6-9548-7dc9158059ff', 'user'),
(gen_random_uuid(), '5ded8a9b-d495-43b6-9548-7dc9158059ff', 'user'),
(gen_random_uuid(), '6ded8a9b-d495-43b6-9548-7dc9158059ff', 'user'),
(gen_random_uuid(), '7ded8a9b-d495-43b6-9548-7dc9158059ff', 'user'),
(gen_random_uuid(), '8ded8a9b-d495-43b6-9548-7dc9158059ff', 'user'),
(gen_random_uuid(), '9ded8a9b-d495-43b6-9548-7dc9158059ff', 'admin');

-- Create profiles for users
INSERT INTO public.profiles (id, user_id, full_name, district, designation) VALUES 
(gen_random_uuid(), '2ded8a9b-d495-43b6-9548-7dc9158059ff', 'R. Kumar', 'Visakhapatnam', 'Inspector'),
(gen_random_uuid(), '3ded8a9b-d495-43b6-9548-7dc9158059ff', 'M. Singh', 'Visakhapatnam', 'SI'),
(gen_random_uuid(), '4ded8a9b-d495-43b6-9548-7dc9158059ff', 'B. Singh', 'Krishna', 'Inspector'),
(gen_random_uuid(), '5ded8a9b-d495-43b6-9548-7dc9158059ff', 'D. Naidu', 'Krishna', 'SI'),
(gen_random_uuid(), '6ded8a9b-d495-43b6-9548-7dc9158059ff', 'I. Sharma', 'Chittoor', 'Inspector'),
(gen_random_uuid(), '7ded8a9b-d495-43b6-9548-7dc9158059ff', 'N. Kumar', 'Anantapur', 'SI'),
(gen_random_uuid(), '8ded8a9b-d495-43b6-9548-7dc9158059ff', 'S. Naidu', 'Kurnool', 'Inspector'),
(gen_random_uuid(), '9ded8a9b-d495-43b6-9548-7dc9158059ff', 'X. Murthy', 'Guntur', 'DSP');

-- Verify all data was created
SELECT 'User roles created: ' || COUNT(*) FROM public.user_roles;
SELECT 'Profiles created: ' || COUNT(*) FROM public.profiles;
