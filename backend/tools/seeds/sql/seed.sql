-- Sample submissions for Road Accident Data Hub
-- User: dinesh@gmail.com (07f78f13-60b4-48f2-8b6e-f845f66ebd94)

INSERT INTO accident_submissions (
  user_id, district, place_of_accident, mandal, police_station, fir_number,
  road_type, accident_date, accident_time, lat_long,
  persons_died, persons_injured,
  vehicles, drivers,
  driver_related_causes, vehicle_condition_causes,
  road_engineering_nature, road_engineering_junctions, road_engineering_signages,
  road_engineering_median, road_engineering_culverts,
  prepared_by_name, prepared_by_designation, prepared_by_date,
  verified_by_name, verified_by_designation, verified_by_date,
  approved_by_name, approved_by_designation, approved_by_date
) VALUES

-- 1. Guntur NH accident
(
  '07f78f13-60b4-48f2-8b6e-f845f66ebd94',
  'Guntur', 'Near Pedakakani Toll Plaza, NH-65', 'Pedakakani', 'Mangalagiri Traffic PS',
  'FIR/2026/GT/0142', 'NH', '2026-01-15', '02:30', '16.3521, 80.5437',
  2, 3,
  '[{"registration_number": "AP07 TZ 4521", "class_type": "Heavy Goods Vehicle (Truck)"}, {"registration_number": "AP39 BK 1198", "class_type": "Motor Car (Sedan)"}]'::jsonb,
  '[{"name": "Ramesh Kumar", "dl_number": "AP07 20190045678", "licensing_authority": "RTA Guntur"}, {"name": "Srinivas Rao", "dl_number": "AP39 20210012345", "licensing_authority": "RTA Ongole"}]'::jsonb,
  '{"The driver was over speeding.": true, "Driver slept while driving.": true, "The driver is having a D.L but not authorised to drive the vehicle involved in the accident.": false, "The driver was under the influence of alcohol at the time of accident.": true, "Driver did not have proper rest / accident happened due to driver fatigue.": true, "The driver is not having any driving licence.": false, "The vehicle was over loaded with goods / passengers.": true, "Passengers were illicitly being carried in the goods vehicle.": false, "The vehicle lights and indicators not working.": false, "The vehicle was being driven in the wrong direction.": false, "The vehicle is parked wrongly on the road.": false, "Driver made an error of judgment during overtaking.": false, "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs.": true, "The driver made an error of judgment of the position of the other vehicle.": false}'::jsonb,
  '{"The braking system failed.": false, "The tyres were not in proper shape / worn out.": true, "The vehicle engine was faulty.": false, "Fitness of the vehicle expired / was not valid at the time of accident.": true, "Over projection of body / load obstructing the view of traffic ahead.": true, "The braking distance was not sufficient.": false, "The status of GPS.": false, "The status of Speed Limiting devices.": true}'::jsonb,
  '{"Village area i.e. highway is passing through the habituated area.": false, "School / College area.": false, "Black Spot.": true, "Blind Spot.": false, "Pilgrim centre / shandy.": false, "Industrial / Institutional area.": false, "Truck / Bus lay bye.": false}'::jsonb,
  '{"Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction.": false, "Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction.": false, "Due to X - Junction / cross road without scientific merging of roads.": false, "Absence of Traffic round about or improper traffic roundabouts.": false, "Railway Crossing.": false, "Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways.": true}'::jsonb,
  '{"No proper signages in the accident area.": true, "Signages are erected but not in proper shape / visibility.": false, "No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.": true, "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.": true, "Merging / diverging of small / arterial roads from the main road.": false, "No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.": false, "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot.": false, "The illumination at the sight is not proper.": true, "Hoardings / billboards at the site are attention distracting.": false}'::jsonb,
  '{"Improper median.": true, "Broken median.": false, "Absence of Median.": false}'::jsonb,
  '{"Curving at the accident spot is very sharp.": false, "Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.": false, "Culvert / bridge at the accident spot.": false, "The width of the road / culvert / bridge is not proper.": false}'::jsonb,
  'SI Venkata Suresh', 'Sub-Inspector, Mangalagiri Traffic PS', '2026-01-16',
  'DSP Lakshmi Narayana', 'DSP Traffic, Guntur', '2026-01-17',
  'SP Arif Hafeez', 'Superintendent of Police, Guntur', '2026-01-18'
),

-- 2. Visakhapatnam SH accident
(
  '07f78f13-60b4-48f2-8b6e-f845f66ebd94',
  'Visakhapatnam', 'Anandapuram - Bheemunipatnam Road, SH-35', 'Bheemunipatnam', 'Bheemunipatnam PS',
  'FIR/2026/VSP/0078', 'SH', '2026-02-03', '18:45', '17.8904, 83.4520',
  1, 5,
  '[{"registration_number": "AP31 UB 7823", "class_type": "Bus (APSRTC)"}, {"registration_number": "AP31 CK 0056", "class_type": "Auto Rickshaw"}]'::jsonb,
  '[{"name": "Appala Naidu", "dl_number": "AP31 20180034567", "licensing_authority": "RTA Visakhapatnam"}, {"name": "Dora Babu", "dl_number": "AP31 20200098765", "licensing_authority": "RTA Visakhapatnam"}]'::jsonb,
  '{"The driver was over speeding.": true, "Driver slept while driving.": false, "The driver is having a D.L but not authorised to drive the vehicle involved in the accident.": false, "The driver was under the influence of alcohol at the time of accident.": false, "Driver did not have proper rest / accident happened due to driver fatigue.": false, "The driver is not having any driving licence.": false, "The vehicle was over loaded with goods / passengers.": true, "Passengers were illicitly being carried in the goods vehicle.": false, "The vehicle lights and indicators not working.": true, "The vehicle was being driven in the wrong direction.": false, "The vehicle is parked wrongly on the road.": false, "Driver made an error of judgment during overtaking.": true, "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs.": false, "The driver made an error of judgment of the position of the other vehicle.": true}'::jsonb,
  '{"The braking system failed.": true, "The tyres were not in proper shape / worn out.": false, "The vehicle engine was faulty.": false, "Fitness of the vehicle expired / was not valid at the time of accident.": false, "Over projection of body / load obstructing the view of traffic ahead.": false, "The braking distance was not sufficient.": true, "The status of GPS.": false, "The status of Speed Limiting devices.": false}'::jsonb,
  '{"Village area i.e. highway is passing through the habituated area.": true, "School / College area.": false, "Black Spot.": false, "Blind Spot.": true, "Pilgrim centre / shandy.": false, "Industrial / Institutional area.": false, "Truck / Bus lay bye.": false}'::jsonb,
  '{"Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction.": false, "Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction.": true, "Due to X - Junction / cross road without scientific merging of roads.": false, "Absence of Traffic round about or improper traffic roundabouts.": false, "Railway Crossing.": false, "Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways.": false}'::jsonb,
  '{"No proper signages in the accident area.": false, "Signages are erected but not in proper shape / visibility.": true, "No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.": false, "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.": false, "Merging / diverging of small / arterial roads from the main road.": true, "No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.": true, "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot.": false, "The illumination at the sight is not proper.": false, "Hoardings / billboards at the site are attention distracting.": false}'::jsonb,
  '{"Improper median.": false, "Broken median.": true, "Absence of Median.": false}'::jsonb,
  '{"Curving at the accident spot is very sharp.": true, "Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.": false, "Culvert / bridge at the accident spot.": false, "The width of the road / culvert / bridge is not proper.": false}'::jsonb,
  'CI Prasad Reddy', 'Circle Inspector, Bheemunipatnam', '2026-02-04',
  'DSP Madhav', 'DSP, Visakhapatnam Rural', '2026-02-05',
  'Addl. SP Kavitha', 'Additional SP, Visakhapatnam', '2026-02-06'
),

-- 3. Tirupati MDR accident
(
  '07f78f13-60b4-48f2-8b6e-f845f66ebd94',
  'Tirupati', 'Chandragiri - Pakala Road, MDR', 'Chandragiri', 'Chandragiri PS',
  'FIR/2026/TPT/0215', 'MDR', '2026-02-20', '07:15', '13.5866, 79.3150',
  3, 1,
  '[{"registration_number": "AP09 TC 3344", "class_type": "Tractor with Trailer"}, {"registration_number": "AP02 ED 9901", "class_type": "Two Wheeler (Motorcycle)"}]'::jsonb,
  '[{"name": "Chinna Obaiah", "dl_number": "AP09 20170023456", "licensing_authority": "RTA Tirupati"}, {"name": "Rajesh Babu", "dl_number": "AP02 20220056789", "licensing_authority": "RTA Chittoor"}]'::jsonb,
  '{"The driver was over speeding.": false, "Driver slept while driving.": false, "The driver is having a D.L but not authorised to drive the vehicle involved in the accident.": true, "The driver was under the influence of alcohol at the time of accident.": true, "Driver did not have proper rest / accident happened due to driver fatigue.": false, "The driver is not having any driving licence.": false, "The vehicle was over loaded with goods / passengers.": true, "Passengers were illicitly being carried in the goods vehicle.": false, "The vehicle lights and indicators not working.": true, "The vehicle was being driven in the wrong direction.": true, "The vehicle is parked wrongly on the road.": false, "Driver made an error of judgment during overtaking.": false, "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs.": false, "The driver made an error of judgment of the position of the other vehicle.": false}'::jsonb,
  '{"The braking system failed.": false, "The tyres were not in proper shape / worn out.": false, "The vehicle engine was faulty.": true, "Fitness of the vehicle expired / was not valid at the time of accident.": true, "Over projection of body / load obstructing the view of traffic ahead.": true, "The braking distance was not sufficient.": false, "The status of GPS.": false, "The status of Speed Limiting devices.": false}'::jsonb,
  '{"Village area i.e. highway is passing through the habituated area.": true, "School / College area.": true, "Black Spot.": false, "Blind Spot.": false, "Pilgrim centre / shandy.": false, "Industrial / Institutional area.": false, "Truck / Bus lay bye.": false}'::jsonb,
  '{"Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction.": false, "Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction.": false, "Due to X - Junction / cross road without scientific merging of roads.": true, "Absence of Traffic round about or improper traffic roundabouts.": true, "Railway Crossing.": false, "Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways.": false}'::jsonb,
  '{"No proper signages in the accident area.": true, "Signages are erected but not in proper shape / visibility.": true, "No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.": true, "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.": true, "Merging / diverging of small / arterial roads from the main road.": false, "No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.": true, "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot.": true, "The illumination at the sight is not proper.": true, "Hoardings / billboards at the site are attention distracting.": false}'::jsonb,
  '{"Improper median.": false, "Broken median.": false, "Absence of Median.": true}'::jsonb,
  '{"Curving at the accident spot is very sharp.": false, "Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.": true, "Culvert / bridge at the accident spot.": true, "The width of the road / culvert / bridge is not proper.": true}'::jsonb,
  'SHO Balaji', 'Station House Officer, Chandragiri PS', '2026-02-21',
  'DSP Ranganath', 'DSP, Tirupati', '2026-02-22',
  'SP Parameswar Reddy', 'Superintendent of Police, Tirupati', '2026-02-23'
),

-- 4. Kurnool NH accident (night)
(
  '07f78f13-60b4-48f2-8b6e-f845f66ebd94',
  'Kurnool', 'Betamcherla - Owk Road Junction, NH-44', 'Betamcherla', 'Betamcherla PS',
  'FIR/2026/KNL/0301', 'NH', '2026-03-05', '23:10', '15.4483, 78.1482',
  4, 2,
  '[{"registration_number": "TS09 FA 6677", "class_type": "Heavy Goods Vehicle (Tanker)"}, {"registration_number": "AP21 AH 5580", "class_type": "Mini Van (Passenger)"}]'::jsonb,
  '[{"name": "Yousuf Khan", "dl_number": "TS09 20160012345", "licensing_authority": "RTA Mahabubnagar"}, {"name": "Venkataiah", "dl_number": "AP21 20190087654", "licensing_authority": "RTA Kurnool"}]'::jsonb,
  '{"The driver was over speeding.": true, "Driver slept while driving.": true, "The driver is having a D.L but not authorised to drive the vehicle involved in the accident.": false, "The driver was under the influence of alcohol at the time of accident.": false, "Driver did not have proper rest / accident happened due to driver fatigue.": true, "The driver is not having any driving licence.": false, "The vehicle was over loaded with goods / passengers.": false, "Passengers were illicitly being carried in the goods vehicle.": false, "The vehicle lights and indicators not working.": false, "The vehicle was being driven in the wrong direction.": true, "The vehicle is parked wrongly on the road.": false, "Driver made an error of judgment during overtaking.": false, "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs.": true, "The driver made an error of judgment of the position of the other vehicle.": true}'::jsonb,
  '{"The braking system failed.": true, "The tyres were not in proper shape / worn out.": true, "The vehicle engine was faulty.": false, "Fitness of the vehicle expired / was not valid at the time of accident.": false, "Over projection of body / load obstructing the view of traffic ahead.": false, "The braking distance was not sufficient.": true, "The status of GPS.": true, "The status of Speed Limiting devices.": true}'::jsonb,
  '{"Village area i.e. highway is passing through the habituated area.": false, "School / College area.": false, "Black Spot.": true, "Blind Spot.": true, "Pilgrim centre / shandy.": false, "Industrial / Institutional area.": false, "Truck / Bus lay bye.": false}'::jsonb,
  '{"Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction.": true, "Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction.": false, "Due to X - Junction / cross road without scientific merging of roads.": false, "Absence of Traffic round about or improper traffic roundabouts.": true, "Railway Crossing.": false, "Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways.": true}'::jsonb,
  '{"No proper signages in the accident area.": true, "Signages are erected but not in proper shape / visibility.": false, "No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.": false, "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.": true, "Merging / diverging of small / arterial roads from the main road.": false, "No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.": false, "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot.": true, "The illumination at the sight is not proper.": true, "Hoardings / billboards at the site are attention distracting.": true}'::jsonb,
  '{"Improper median.": true, "Broken median.": true, "Absence of Median.": false}'::jsonb,
  '{"Curving at the accident spot is very sharp.": true, "Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.": false, "Culvert / bridge at the accident spot.": false, "The width of the road / culvert / bridge is not proper.": true}'::jsonb,
  'IO Shiva Shankar', 'Investigation Officer, Betamcherla PS', '2026-03-06',
  'CI Raghunath', 'Circle Inspector, Kurnool Rural', '2026-03-07',
  'SP Fakeerappa', 'Superintendent of Police, Kurnool', '2026-03-08'
),

-- 5. East Godavari Other road accident
(
  '07f78f13-60b4-48f2-8b6e-f845f66ebd94',
  'East Godavari', 'Kakinada - Peddapuram Bypass Road', 'Peddapuram', 'Peddapuram Town PS',
  'FIR/2026/EG/0189', 'Other', '2026-03-12', '11:00', '17.0784, 82.1321',
  1, 4,
  '[{"registration_number": "AP05 BW 2233", "class_type": "School Bus"}, {"registration_number": "AP05 DK 8844", "class_type": "Goods Carrier (Mini Truck)"}, {"registration_number": "AP28 MZ 0011", "class_type": "Two Wheeler (Scooter)"}]'::jsonb,
  '[{"name": "Subrahmanyam", "dl_number": "AP05 20200011223", "licensing_authority": "RTA Kakinada"}, {"name": "Naga Raju", "dl_number": "AP05 20180044556", "licensing_authority": "RTA Kakinada"}, {"name": "Lakshmi Devi", "dl_number": "AP28 20210033445", "licensing_authority": "RTA Nellore"}]'::jsonb,
  '{"The driver was over speeding.": false, "Driver slept while driving.": false, "The driver is having a D.L but not authorised to drive the vehicle involved in the accident.": false, "The driver was under the influence of alcohol at the time of accident.": false, "Driver did not have proper rest / accident happened due to driver fatigue.": false, "The driver is not having any driving licence.": true, "The vehicle was over loaded with goods / passengers.": false, "Passengers were illicitly being carried in the goods vehicle.": false, "The vehicle lights and indicators not working.": false, "The vehicle was being driven in the wrong direction.": false, "The vehicle is parked wrongly on the road.": true, "Driver made an error of judgment during overtaking.": true, "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs.": false, "The driver made an error of judgment of the position of the other vehicle.": true}'::jsonb,
  '{"The braking system failed.": false, "The tyres were not in proper shape / worn out.": true, "The vehicle engine was faulty.": false, "Fitness of the vehicle expired / was not valid at the time of accident.": false, "Over projection of body / load obstructing the view of traffic ahead.": true, "The braking distance was not sufficient.": false, "The status of GPS.": false, "The status of Speed Limiting devices.": false}'::jsonb,
  '{"Village area i.e. highway is passing through the habituated area.": false, "School / College area.": true, "Black Spot.": false, "Blind Spot.": false, "Pilgrim centre / shandy.": true, "Industrial / Institutional area.": false, "Truck / Bus lay bye.": false}'::jsonb,
  '{"Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction.": false, "Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction.": false, "Due to X - Junction / cross road without scientific merging of roads.": true, "Absence of Traffic round about or improper traffic roundabouts.": false, "Railway Crossing.": true, "Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways.": true}'::jsonb,
  '{"No proper signages in the accident area.": true, "Signages are erected but not in proper shape / visibility.": true, "No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.": false, "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.": false, "Merging / diverging of small / arterial roads from the main road.": true, "No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.": false, "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot.": false, "The illumination at the sight is not proper.": false, "Hoardings / billboards at the site are attention distracting.": true}'::jsonb,
  '{"Improper median.": false, "Broken median.": false, "Absence of Median.": true}'::jsonb,
  '{"Curving at the accident spot is very sharp.": false, "Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.": false, "Culvert / bridge at the accident spot.": true, "The width of the road / culvert / bridge is not proper.": true}'::jsonb,
  'SHO Ramana Murthy', 'Station House Officer, Peddapuram Town PS', '2026-03-13',
  'DSP Satya Rao', 'DSP, Peddapuram Division', '2026-03-14',
  'SP Vikas Kumar', 'Superintendent of Police, East Godavari', '2026-03-15'
);
