-- Fix missing user roles for district users
INSERT INTO user_roles (id, user_id, role)
SELECT gen_random_uuid(), u.id, 'user'
FROM users u
WHERE u.email IN ('visakhapatnam', 'krishna', 'guntur', 'chittoor', 'anantapur', 'kurnool', 'nellore')
AND NOT EXISTS (
    SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'user'
);

-- Verify the fix
SELECT u.email, p.district, r.role FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN user_roles r ON r.user_id = u.id
WHERE u.email IN ('visakhapatnam', 'krishna', 'guntur', 'chittoor', 'anantapur', 'kurnool', 'nellore')
ORDER BY u.email, r.role;
