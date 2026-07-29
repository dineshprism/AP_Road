-- Simple approach: Create one admin user and use it for all accidents
INSERT INTO auth.users (id, email, password_hash, created_at) 
VALUES ('admin-test-123', 'admin@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOe', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (id, user_id, role) 
VALUES (gen_random_uuid(), 'admin-test-123', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.profiles (id, user_id, full_name, district, designation) 
VALUES (gen_random_uuid(), 'admin-test-123', 'Test Admin', 'Guntur', 'DSP')
ON CONFLICT (user_id) DO NOTHING;

-- Now create accidents with this user ID
INSERT INTO public.accident_submissions (
  id, user_id, district, place_of_accident, mandal, police_station, fir_number, 
  road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
  vehicles, drivers, driver_related_causes, vehicle_condition_causes,
  road_engineering_nature, road_engineering_junctions, road_engineering_signages,
  road_engineering_median, road_engineering_culverts, prepared_by_name,
  prepared_by_designation, prepared_by_date, verified_by_name, verified_by_designation,
  verified_by_date, approved_by_name, approved_by_designation, approved_by_date
) VALUES 
(gen_random_uuid(), 'admin-test-123', 'Visakhapatnam', 'NH-16 near Gopalapatnam', 'Visakhapatnam Rural', 'Gopalapatnam PS', 'FIR/123/2024', 'National Highway', '2024-01-15', '14:30', '17.7152, 83.2483', 2, 3,
 '[{"type": "Car", "registration": "AP-23-AB-1234"}]', '[{"name": "John Doe", "license": "DL-123456"}]', 
 '{"speeding": true, "drunken_driving": false}', '{"tire_burst": false, "brake_failure": true}',
 '{"potholes": true, "uneven_surface": false}', '{"no_signals": false, "blind_spot": true}',
 '{"missing_signs": true, "poor_visibility": false}', '{"no_median": false, "damaged_median": true}',
 '{"blocked": false, "narrow": true}', 'R. Kumar', 'Inspector', '2024-01-16', 'S. Rao', 'DSP', '2024-01-17', 'P. Reddy', 'SP', '2024-01-18'),

(gen_random_uuid(), 'admin-test-123', 'Krishna', 'NH-65 near Benz Circle', 'Vijayawada Urban', 'Patamata PS', 'FIR/125/2024', 'National Highway', '2024-03-10', '08:45', '16.5062, 80.6480', 3, 1,
 '[{"type": "Truck", "registration": "AP-16-EF-9012"}, {"type": "Auto", "registration": "AP-16-GH-3456"}]', '[{"name": "B. Singh", "license": "DL-345678"}, {"name": "C. Kumar", "license": "DL-901234"}]', 
 '{"speeding": false, "drunken_driving": false}', '{"tire_burst": false, "brake_failure": false}',
 '{"potholes": true, "uneven_surface": true}', '{"no_signals": false, "blind_spot": false}',
 '{"missing_signs": true, "poor_visibility": false}', '{"no_median": false, "damaged_median": false}',
 '{"blocked": false, "narrow": false}', 'T. Reddy', 'Inspector', '2024-03-11', 'U. Kumar', 'DSP', '2024-03-12', 'V. Rao', 'SP', '2024-03-13'),

(gen_random_uuid(), 'admin-test-123', 'Guntur', 'NH-16 near Chilakaluripet', 'Guntur Rural', 'Chilakaluripet PS', 'FIR/130/2024', 'National Highway', '2024-08-22', '16:30', '16.1645, 80.2584', 2, 5,
 '[{"type": "Truck", "registration": "AP-21-XA-1234"}, {"type": "Auto", "registration": "AP-21-YB-5678"}, {"type": "Bike", "registration": "AP-21-ZC-9012"}]', '[{"name": "X. Murthy", "license": "DL-123456"}, {"name": "Y. Gupta", "license": "DL-789012"}, {"name": "Z. Ahmed", "license": "DL-345678"}]', 
 '{"speeding": true, "drunken_driving": false}', '{"tire_burst": false, "brake_failure": true}',
 '{"potholes": true, "uneven_surface": false}', '{"no_signals": true, "blind_spot": false}',
 '{"missing_signs": false, "poor_visibility": true}', '{"no_median": true, "damaged_median": false}',
 '{"blocked": false, "narrow": true}', 'AA. Rao', 'SI', '2024-08-23', 'BB. Singh', 'Inspector', '2024-08-24', 'CC. Kumar', 'DSP', '2024-08-25');

-- Verify data was created
SELECT 'Accidents created: ' || COUNT(*) FROM public.accident_submissions;
SELECT 'Users created: ' || COUNT(*) FROM auth.users;
