-- Check existing DGP and ADGP users and their passwords
SELECT email, id, created_at FROM users WHERE email IN ('dgp', 'adgp') ORDER BY email;

-- If no users found, check auth.users table
SELECT email, id, created_at FROM auth.users WHERE email IN ('dgp', 'adgp') ORDER BY email;

-- Check all admin-level users
SELECT email, id FROM users WHERE email IN ('dgp', 'adgp') 
UNION
SELECT email, id FROM auth.users WHERE email IN ('dgp', 'adgp');

-- Show all users to see the pattern
SELECT email, id FROM users ORDER BY email LIMIT 10;
