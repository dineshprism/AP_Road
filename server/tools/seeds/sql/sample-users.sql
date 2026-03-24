-- Sample users for testing accident data
INSERT INTO auth.users (id, email, password_hash, created_at) VALUES 
('2ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer1@example.com', '$2b$12$hashed_password_here', NOW()),
('3ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer2@example.com', '$2b$12$hashed_password_here', NOW()),
('4ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer3@example.com', '$2b$12$hashed_password_here', NOW()),
('5ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer4@example.com', '$2b$12$hashed_password_here', NOW()),
('6ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer5@example.com', '$2b$12$hashed_password_here', NOW()),
('7ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer6@example.com', '$2b$12$hashed_password_here', NOW()),
('8ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer7@example.com', '$2b$12$hashed_password_here', NOW()),
('9ded8a9b-d495-43b6-9548-7dc9158059ff', 'officer8@example.com', '$2b$12$hashed_password_here', NOW());

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
