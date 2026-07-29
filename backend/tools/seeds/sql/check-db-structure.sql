-- Check your actual database structure
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%user%';
SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth';

-- Check if users table exists in public schema
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public' ORDER BY ordinal_position;

-- Check if auth.users exists
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'auth' ORDER BY ordinal_position;

-- Show what's actually in your users table
SELECT COUNT(*) as total_users, email FROM users GROUP BY email ORDER BY email;
SELECT COUNT(*) as total_auth_users, email FROM auth.users GROUP BY email ORDER BY email;
