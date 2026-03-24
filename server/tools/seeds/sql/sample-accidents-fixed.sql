-- Sample accident data with CORRECT user IDs that actually exist
INSERT INTO public.accident_submissions (
  id, user_id, district, place_of_accident, mandal, police_station, fir_number, 
  road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
  vehicles, drivers, driver_related_causes, vehicle_condition_causes,
  road_engineering_nature, road_engineering_junctions, road_engineering_signages,
  road_engineering_median, road_engineering_culverts, prepared_by_name,
  prepared_by_designation, prepared_by_date, verified_by_name, verified_by_designation,
  verified_by_date, approved_by_name, approved_by_designation, approved_by_date
) VALUES 
-- Visakhapatnam accidents (using user IDs from setup-users-fixed.sql)
(gen_random_uuid(), '2ded8a9b-d495-43b6-9548-7dc9158059ff', 'Visakhapatnam', 'NH-16 near Gopalapatnam', 'Visakhapatnam Rural', 'Gopalapatnam PS', 'FIR/123/2024', 'National Highway', '2024-01-15', '14:30', '17.7152, 83.2483', 2, 3,
 '[{"type": "Car", "registration": "AP-23-AB-1234"}]', '[{"name": "John Doe", "license": "DL-123456"}]', 
 '{"speeding": true, "drunken_driving": false}', '{"tire_burst": false, "brake_failure": true}',
 '{"potholes": true, "uneven_surface": false}', '{"no_signals": false, "blind_spot": true}',
 '{"missing_signs": true, "poor_visibility": false}', '{"no_median": false, "damaged_median": true}',
 '{"blocked": false, "narrow": true}', 'R. Kumar', 'Inspector', '2024-01-16', 'S. Rao', 'DSP', '2024-01-17', 'P. Reddy', 'SP', '2024-01-18'),

(gen_random_uuid(), '3ded8a9b-d495-43b6-9548-7dc9158059ff', 'Visakhapatnam', 'Beach Road near RK Beach', 'Visakhapatnam Urban', 'Beach Road PS', 'FIR/124/2024', 'City Road', '2024-02-20', '20:15', '17.7245, 83.2678', 1, 2,
 '[{"type": "Bike", "registration": "AP-31-CD-5678"}]', '[{"name": "A. Kumar", "license": "DL-789012"}]', 
 '{"speeding": true, "drunken_driving": true}', '{"tire_burst": true, "brake_failure": false}',
 '{"potholes": false, "uneven_surface": true}', '{"no_signals": true, "blind_spot": false}',
 '{"missing_signs": false, "poor_visibility": true}', '{"no_median": true, "damaged_median": false}',
 '{"blocked": true, "narrow": false}', 'M. Singh', 'SI', '2024-02-21', 'N. Patel', 'Inspector', '2024-02-22', 'L. Gupta', 'DSP', '2024-02-23'),

-- Vijayawada accidents (Krishna district)
(gen_random_uuid(), '4ded8a9b-d495-43b6-9548-7dc9158059ff', 'Krishna', 'NH-65 near Benz Circle', 'Vijayawada Urban', 'Patamata PS', 'FIR/125/2024', 'National Highway', '2024-03-10', '08:45', '16.5062, 80.6480', 3, 1,
 '[{"type": "Truck", "registration": "AP-16-EF-9012"}, {"type": "Auto", "registration": "AP-16-GH-3456"}]', '[{"name": "B. Singh", "license": "DL-345678"}, {"name": "C. Kumar", "license": "DL-901234"}]', 
 '{"speeding": false, "drunken_driving": false}', '{"tire_burst": false, "brake_failure": false}',
 '{"potholes": true, "uneven_surface": true}', '{"no_signals": false, "blind_spot": false}',
 '{"missing_signs": true, "poor_visibility": false}', '{"no_median": false, "damaged_median": false}',
 '{"blocked": false, "narrow": false}', 'T. Reddy', 'Inspector', '2024-03-11', 'U. Kumar', 'DSP', '2024-03-12', 'V. Rao', 'SP', '2024-03-13'),

(gen_random_uuid(), '5ded8a9b-d495-43b6-9548-7dc9158059ff', 'Krishna', 'Eluru Road near Auto Nagar', 'Vijayawada Rural', 'Autonagar PS', 'FIR/126/2024', 'State Highway', '2024-04-05', '17:20', '16.5124, 80.6521', 1, 4,
 '[{"type": "Bus", "registration": "AP-16-HI-7890"}, {"type": "Bike", "registration": "AP-16-JK-1234"}]', '[{"name": "D. Naidu", "license": "DL-567890"}, {"name": "E. Reddy", "license": "DL-234567"}]', 
 '{"speeding": true, "drunken_driving": false}', '{"tire_burst": false, "brake_failure": true}',
 '{"potholes": false, "uneven_surface": false}', '{"no_signals": true, "blind_spot": true}',
 '{"missing_signs": false, "poor_visibility": false}', '{"no_median": true, "damaged_median": false}',
 '{"blocked": false, "narrow": true}', 'F. Ahmed', 'SI', '2024-04-06', 'G. Prasad', 'Inspector', '2024-04-07', 'H. Babu', 'DSP', '2024-04-08'),

-- Tirupati accidents (Chittoor district)
(gen_random_uuid(), '6ded8a9b-d495-43b6-9548-7dc9158059ff', 'Chittoor', 'Alipiri Road near Foot Hills', 'Tirupati Urban', 'Alipiri PS', 'FIR/127/2024', 'Ghat Road', '2024-05-12', '06:30', '13.6587, 79.4187', 2, 2,
 '[{"type": "Jeep", "registration": "AP-13-LM-4567"}, {"type": "Car", "registration": "AP-13-NO-8901"}]', '[{"name": "I. Sharma", "license": "DL-123456"}, {"name": "J. Reddy", "license": "DL-789012"}]', 
 '{"speeding": true, "drunken_driving": false}', '{"tire_burst": true, "brake_failure": false}',
 '{"potholes": true, "uneven_surface": true}', '{"no_signals": false, "blind_spot": false}',
 '{"missing_signs": true, "poor_visibility": true}', '{"no_median": false, "damaged_median": true}',
 '{"blocked": true, "narrow": true}', 'K. Murthy', 'Inspector', '2024-05-13', 'L. Naidu', 'DSP', '2024-05-14', 'M. Rao', 'SP', '2024-05-15'),

-- Anantapur accidents
(gen_random_uuid(), '7ded8a9b-d495-43b6-9548-7dc9158059ff', 'Anantapur', 'NH-44 near Uravakonda', 'Anantapur Rural', 'Uravakonda PS', 'FIR/128/2024', 'National Highway', '2024-06-18', '22:45', '14.7452, 77.6218', 1, 3,
 '[{"type": "Truck", "registration": "AP-34-PQ-2345"}, {"type": "Bike", "registration": "AP-34-RS-6789"}]', '[{"name": "N. Kumar", "license": "DL-345678"}, {"name": "O. Singh", "license": "DL-901234"}]', 
 '{"speeding": true, "drunken_driving": true}', '{"tire_burst": false, "brake_failure": true}',
 '{"potholes": false, "uneven_surface": false}', '{"no_signals": true, "blind_spot": false}',
 '{"missing_signs": false, "poor_visibility": true}', '{"no_median": false, "damaged_median": false}',
 '{"blocked": false, "narrow": false}', 'P. Reddy', 'SI', '2024-06-19', 'Q. Ahmed', 'Inspector', '2024-06-20', 'R. Gupta', 'DSP', '2024-06-21'),

-- Kurnool accidents
(gen_random_uuid(), '8ded8a9b-d495-43b6-9548-7dc9158059ff', 'Kurnool', 'NH-40 near Nandyal', 'Kurnool Rural', 'Nandyal PS', 'FIR/129/2024', 'National Highway', '2024-07-08', '11:20', '15.4846, 78.4832', 4, 2,
 '[{"type": "Bus", "registration": "AP-39-TU-5678"}, {"type": "Car", "registration": "AP-39-VW-9012"}]', '[{"name": "S. Naidu", "license": "DL-567890"}, {"name": "T. Rao", "license": "DL-234567"}]', 
 '{"speeding": false, "drunken_driving": false}', '{"tire_burst": true, "brake_failure": true}',
 '{"potholes": true, "uneven_surface": true}', '{"no_signals": false, "blind_spot": true}',
 '{"missing_signs": true, "poor_visibility": false}', '{"no_median": false, "damaged_median": true}',
 '{"blocked": true, "narrow": false}', 'U. Singh', 'Inspector', '2024-07-09', 'V. Kumar', 'DSP', '2024-07-10', 'W. Reddy', 'SP', '2024-07-11'),

-- Guntur accidents (admin user)
(gen_random_uuid(), '9ded8a9b-d495-43b6-9548-7dc9158059ff', 'Guntur', 'NH-16 near Chilakaluripet', 'Guntur Rural', 'Chilakaluripet PS', 'FIR/130/2024', 'National Highway', '2024-08-22', '16:30', '16.1645, 80.2584', 2, 5,
 '[{"type": "Truck", "registration": "AP-21-XA-1234"}, {"type": "Auto", "registration": "AP-21-YB-5678"}, {"type": "Bike", "registration": "AP-21-ZC-9012"}]', '[{"name": "X. Murthy", "license": "DL-123456"}, {"name": "Y. Gupta", "license": "DL-789012"}, {"name": "Z. Ahmed", "license": "DL-345678"}]', 
 '{"speeding": true, "drunken_driving": false}', '{"tire_burst": false, "brake_failure": true}',
 '{"potholes": true, "uneven_surface": false}', '{"no_signals": true, "blind_spot": false}',
 '{"missing_signs": false, "poor_visibility": true}', '{"no_median": true, "damaged_median": false}',
 '{"blocked": false, "narrow": true}', 'AA. Rao', 'SI', '2024-08-23', 'BB. Singh', 'Inspector', '2024-08-24', 'CC. Kumar', 'DSP', '2024-08-25'),

-- Nellore accidents (additional user from Guntur admin)
(gen_random_uuid(), '9ded8a9b-d495-43b6-9548-7dc9158059ff', 'Nellore', 'NH-5 near Nellore Bypass', 'Nellore Urban', 'Nellore Bypass PS', 'FIR/131/2024', 'National Highway', '2024-09-14', '09:15', '14.4426, 79.9865', 1, 2,
 '[{"type": "Car", "registration": "AP-37-DE-3456"}, {"type": "Bike", "registration": "AP-37-FG-7890"}]', '[{"name": "DD. Reddy", "license": "DL-567890"}, {"name": "EE. Naidu", "license": "DL-234567"}]', 
 '{"speeding": false, "drunken_driving": true}', '{"tire_burst": true, "brake_failure": false}',
 '{"potholes": false, "uneven_surface": true}', '{"no_signals": false, "blind_spot": false}',
 '{"missing_signs": true, "poor_visibility": false}', '{"no_median": false, "damaged_median": false}',
 '{"blocked": false, "narrow": false}', 'FF. Sharma', 'Inspector', '2024-09-15', 'GG. Patel', 'DSP', '2024-09-16', 'HH. Gupta', 'SP', '2024-09-17');
