-- Check what user IDs actually exist
SELECT id, email FROM auth.users ORDER BY id;

-- Check what user IDs the sample accidents are trying to use
SELECT DISTINCT user_id FROM (VALUES 
('3ebe150d-bc87-49ae-b10d-79f99079514f'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
-- Add other IDs from sample-accidents.sql if needed
) AS sample_ids(user_id) WHERE user_id NOT IN (SELECT id FROM auth.users);
