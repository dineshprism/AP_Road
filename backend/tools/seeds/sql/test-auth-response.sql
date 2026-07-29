-- Check if there are any authentication issues by testing the API response
-- This simulates what the frontend gets when calling /api/auth/me

SELECT 
    u.id as user_id,
    u.email,
    p.full_name,
    p.district,
    p.designation,
    COALESCE(r.roles, ARRAY[]::text[]) as roles,
    COALESCE(r.roles && ARRAY['admin', 'dgp', 'adgp'], false) as is_admin
FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN (
    SELECT user_id, array_agg(role) as roles 
    FROM user_roles 
    GROUP BY user_id
) r ON r.user_id = u.id
WHERE u.email = 'visakhapatnam';
