-- Quick fix for "No analytics data available"
-- Run this in PostgreSQL to add sample accident data

-- First check current data
SELECT 'Current accident submissions count:' as info, COUNT(*) as count FROM accident_submissions;

-- Add sample accident data if table is empty
INSERT INTO accident_submissions (
  id, district, place_of_accident, mandal, police_station, fir_number,
  road_type, accident_date, accident_time, persons_died, persons_injured,
  vehicles, drivers, driver_related_causes, vehicle_condition_causes,
  road_engineering_culverts, road_engineering_junctions, road_engineering_median,
  road_engineering_nature, road_engineering_signages, created_at, user_id
) VALUES 
-- Sample 1
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
  '[{"name": "R. Kumar", "dl_number": "AP-39-2012-001234", "licensing_authority": "RTO Guntur"}]',
  '{"The driver was over speeding.": true, "Driver made an error of judgment during overtaking.": true}',
  '{"The braking system failed.": true}',
  '{"Curving at the accident spot is very sharp.": true}',
  '{"Due to convergence of traffic at the Y - Junction.": true}',
  '{"Improper median.": true}',
  '{"Village area i.e. highway is passing through the habituated area.": true}',
  '{"No proper signages in the accident area.": true}',
  NOW(),
  'dgp-user-id'
),
-- Sample 2
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
  '[{"registration_number": "AP-31-CD-9012", "class_type": "Motorcycle"}]',
  '[{"name": "P. Naidu", "dl_number": "AP-31-2018-009876", "licensing_authority": "RTO Visakhapatnam"}]',
  '{"The driver was under the influence of alcohol at the time of accident.": true}',
  '{"The vehicle lights and indicators not working.": true}',
  '{}',
  '{"Due to convergence of traffic at the T - Junction.": true}',
  '{"Absence of Median.": true}',
  '{"School / College area.": true}',
  '{"No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.": true}',
  NOW(),
  'dgp-user-id'
),
-- Sample 3
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
  '[{"registration_number": "AP-16-GH-7890", "class_type": "Bus"}]',
  '[{"name": "M. Krishna", "dl_number": "AP-16-2014-003456", "licensing_authority": "RTO Vijayawada"}]',
  '{"The vehicle was over loaded with goods / passengers.": true}',
  '{"Fitness of the vehicle expired / was not valid at the time of accident.": true}',
  '{"Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.": true}',
  '{}',
  '{"Broken median.": true}',
  '{"Black Spot.": true}',
  '{"No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.": true}',
  NOW(),
  'dgp-user-id'
);

-- Verify insertion
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
LIMIT 3;
