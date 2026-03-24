-- Get existing user IDs for districts to create sample data
SELECT email, id FROM users WHERE email IN ('visakhapatnam', 'krishna', 'guntur', 'chittoor', 'anantapur', 'kurnool', 'nellore') ORDER BY email;

-- If no users in public.users, check auth.users
SELECT email, id FROM auth.users WHERE email IN ('visakhapatnam', 'krishna', 'guntur', 'chittoor', 'anantapur', 'kurnool', 'nellore') ORDER BY email;

-- Show all district users
SELECT email, id FROM users WHERE email NOT IN ('dgp', 'adgp') ORDER BY email LIMIT 10;
