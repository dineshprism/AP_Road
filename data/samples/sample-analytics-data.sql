-- Quick Sample Data for Analytics Testing
-- This will create sample accident submissions to test the enhanced analytics dashboard

-- First, let's check if we have any existing data
SELECT 'Current accident submissions count:' as info, COUNT(*) as count FROM accident_submissions;

-- Insert sample accident submissions if table is empty
INSERT INTO accident_submissions (
  id, district, place_of_accident, mandal, police_station, fir_number,
  road_type, accident_date, accident_time, persons_died, persons_injured,
  vehicles, drivers, driver_related_causes, vehicle_condition_causes,
  road_engineering_culverts, road_engineering_junctions, road_engineering_median,
  road_engineering_nature, road_engineering_signages, created_at, user_id
) VALUES 
-- Sample 1: Highway accident with multiple vehicles
(
  gen_random_uuid(), 
  'Guntur', 
  'NH-65 near Sattenapalli', 
  'Sattenapalli', 
  'Sattenapalli Police Station', 
  'FIR/2024/001', 
  'NH', 
  '2024-01-15', 
  '14:30', 
  2, 
  3,
  '[{"registration_number": "AP-39-AB-1234", "class_type": "Truck"}, {"registration_number": "AP-39-XY-5678", "class_type": "Car"}]',
  '[{"name": "R. Kumar", "dl_number": "AP-39-2012-001234", "licensing_authority": "RTO Guntur"}, {"name": "S. Reddy", "dl_number": "AP-39-2015-005678", "licensing_authority": "RTO Guntur"}]',
  '{"The driver was over speeding.": true, "Driver made an error of judgment during overtaking.": true}',
  '{"The braking system failed.": true, "The tyres were not in proper shape / worn out.": true}',
  '{"Curving at the accident spot is very sharp.": true}',
  '{"Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction.": true}',
  '{"Improper median.": true}',
  '{"Village area i.e. highway is passing through the habituated area.": true}',
  '{"No proper signages in the accident area.": true, "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.": true}',
  NOW(),
  (SELECT id FROM auth.users WHERE email = 'dgp' LIMIT 1)
),
-- Sample 2: Urban intersection accident
(
  gen_random_uuid(), 
  'Visakhapatnam', 
  'Waltair Junction', 
  'Visakhapatnam', 
  'Waltair Police Station', 
  'FIR/2024/002', 
  'SH', 
  '2024-02-20', 
  '18:45', 
  1, 
  2,
  '[{"registration_number": "AP-31-CD-9012", "class_type": "Motorcycle"}, {"registration_number": "AP-31-EF-3456", "class_type": "Auto Rickshaw"}]',
  '[{"name": "P. Naidu", "dl_number": "AP-31-2018-009876", "licensing_authority": "RTO Visakhapatnam"}, {"name": "K. Rao", "dl_number": "AP-31-2019-012345", "licensing_authority": "RTO Visakhapatnam"}]',
  '{"The driver was under the influence of alcohol at the time of accident.": true, "Driver did not have proper rest / accident happened due to driver fatigue.": true}',
  '{"The vehicle lights and indicators not working.": true}',
  '{}',
  '{"Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction.": true}',
  '{"Absence of Median.": true}',
  '{"School / College area.": true}',
  '{"No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.": true}',
  NOW(),
  (SELECT id FROM auth.users WHERE email = 'dgp' LIMIT 1)
),
-- Sample 3: Rural road accident
(
  gen_random_uuid(), 
  'Krishna', 
  'Near Nandigama Village', 
  'Nandigama', 
  'Nandigama Police Station', 
  'FIR/2024/003', 
  'MDR', 
  '2024-03-10', 
  '22:15', 
  3, 
  4,
  '[{"registration_number": "AP-16-GH-7890", "class_type": "Bus"}, {"registration_number": "AP-16-IJ-2345", "class_type": "Tractor"}]',
  '[{"name": "M. Krishna", "dl_number": "AP-16-2014-003456", "licensing_authority": "RTO Vijayawada"}, {"name": "L. Prasad", "dl_number": "AP-16-2016-007890", "licensing_authority": "RTO Vijayawada"}]',
  '{"The vehicle was over loaded with goods / passengers.": true, "Passengers were illicitly being carried in the goods vehicle.": true}',
  '{"Fitness of the vehicle expired / was not valid at the time of accident.": true}',
  '{"Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.": true}',
  '{}',
  '{"Broken median.": true}',
  '{"Black Spot.": true}',
  '{"No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.": true, "The illumination at the sight is not proper.": true}',
  NOW(),
  (SELECT id FROM auth.users WHERE email = 'dgp' LIMIT 1)
),
-- Sample 4: Multiple vehicle highway accident
(
  gen_random_uuid(), 
  'Chittoor', 
  'Tirupati Bypass', 
  'Tirupati', 
  'Tirupati Rural Police Station', 
  'FIR/2024/004', 
  'NH', 
  '2024-04-05', 
  '06:30', 
  1, 
  5,
  '[{"registration_number": "AP-13-KL-4567", "class_type": "Car"}, {"registration_number": "AP-13-MN-8901", "class_type": "Truck"}, {"registration_number": "AP-13-OP-2345", "class_type": "Motorcycle"}]',
  '[{"name": "V. Sharma", "dl_number": "AP-13-2017-005678", "licensing_authority": "RTO Chittoor"}, {"name": "R. Kumar", "dl_number": "AP-13-2019-009012", "licensing_authority": "RTO Chittoor"}]',
  '{"Driver slept while driving.": true, "The vehicle was being driven in the wrong direction.": true}',
  '{"The braking distance was not sufficient.": true}',
  '{}',
  '{"Railway Crossing.": true}',
  '{}',
  '{"Pilgrim centre / shandy.": true}',
  '{"Merging / diverging of small / arterial roads from the main road.": true}',
  NOW(),
  (SELECT id FROM auth.users WHERE email = 'dgp' LIMIT 1)
),
-- Sample 5: City road accident
(
  gen_random_uuid(), 
  'Kurnool', 
  'Near RTC Bus Stand', 
  'Kurnool', 
  "Kurnool One Town Police Station", 
  'FIR/2024/005', 
  'Other', 
  '2024-05-12', 
  '19:20', 
  2, 
  6,
  '[{"registration_number": "AP-29-ST-6789", "class_type": "Bus"}, {"registration_number": "AP-29-UV-1234", "class_type": "Car"}]',
  '[{"name": "S. Ahmed", "dl_number": "AP-29-2013-002345", "licensing_authority": "RTO Kurnool"}, {"name": "A. Patel", "dl_number": "AP-29-2018-006789", "licensing_authority": "RTO Kurnool"}]',
  '{"Driver made an error of judgment of the position of the other vehicle.": true, "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs.": true}',
  '{"Over projection of body / load obstructing the view of traffic ahead.": true}',
  '{}',
  '{"Absence of Traffic round about or improper traffic roundabouts.": true}',
  '{"Improper median.": true}',
  '{"Industrial / Institutional area.": true}',
  '{"Signages are erected but not in proper shape / visibility.": true, "Hoardings / billboards at the site are attention distracting.": true}',
  NOW(),
  (SELECT id FROM auth.users WHERE email = 'dgp' LIMIT 1)
);

-- Verify data insertion
SELECT 'After insertion - accident submissions count:' as info, COUNT(*) as count FROM accident_submissions;

-- Show sample data
SELECT 
  district, 
  place_of_accident, 
  road_type, 
  persons_died, 
  persons_injured, 
  accident_date::text as date
FROM accident_submissions 
ORDER BY accident_date DESC 
LIMIT 5;
