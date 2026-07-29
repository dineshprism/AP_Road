-- Check what roles your district users actually have
SELECT u.email, p.district, r.role FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN user_roles r ON r.user_id = u.id
WHERE u.email IN ('visakhapatnam', 'krishna', 'guntur', 'chittoor', 'anantapur', 'kurnool', 'nellore')
ORDER BY u.email, r.role;

-- Check if DGP/ADGP users exist
SELECT u.email, p.district, r.role FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN user_roles r ON r.user_id = u.id
WHERE u.email IN ('dgp', 'adgp')
ORDER BY u.email, r.role;
