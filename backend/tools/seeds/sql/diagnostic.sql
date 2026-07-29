-- Check if auth schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';

-- Check if auth.users table exists
SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users';

-- Check what's in auth.users
SELECT 'auth.users count: ' || COUNT(*) FROM auth.users;

-- Check if there are any users at all
SELECT id, email FROM auth.users LIMIT 5;

-- Check if the foreign key constraint exists and what it references
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'accident_submissions';
