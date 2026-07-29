-- Add missing admin users (DGP/ADGP) only
INSERT INTO auth.users (id, email, password_hash, created_at) VALUES 
('dgp-user-id', 'dgp', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW()),
('adgp-user-id', 'adgp', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW())
ON CONFLICT (email) DO NOTHING;

-- Assign admin roles
INSERT INTO public.user_roles (id, user_id, role) VALUES 
(gen_random_uuid(), 'dgp-user-id', 'dgp'),
(gen_random_uuid(), 'adgp-user-id', 'adgp')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create profiles for admin users
INSERT INTO public.profiles (id, user_id, full_name, district, designation) VALUES 
(gen_random_uuid(), 'dgp-user-id', 'DGP Officer', 'State HQ', 'Director General of Police'),
(gen_random_uuid(), 'adgp-user-id', 'ADGP Officer', 'State HQ', 'Additional Director General of Police')
ON CONFLICT (user_id) DO NOTHING;

-- Check existing district users
SELECT email, id FROM auth.users WHERE email IN ('visakhapatnam', 'krishna', 'guntur', 'chittoor', 'anantapur', 'kurnool', 'nellore') ORDER BY email;
