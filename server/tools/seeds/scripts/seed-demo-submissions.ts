import pool from "../../../src/db.js";

type CauseMap = Record<string, boolean>;

interface DemoSubmission {
  fir: string;
  place: string;
  mandal: string;
  policeStation: string;
  roadType: "NH" | "SH" | "MDR" | "Other";
  accidentDate: string;
  accidentTime: string;
  latLong: string;
  personsDied: number;
  personsInjured: number;
  vehicles: Array<{ registration_number: string; class_type: string }>;
  drivers: Array<{ name: string; dl_number: string; licensing_authority: string }>;
  driverCauses: CauseMap;
  vehicleCauses: CauseMap;
  roadNature: CauseMap;
  roadJunctions: CauseMap;
  roadSignages: CauseMap;
  roadMedian: CauseMap;
  roadCulverts: CauseMap;
  preparedByName: string;
  preparedByDesignation: string;
  preparedByDate: string;
  verifiedByName: string;
  verifiedByDesignation: string;
  verifiedByDate: string;
  approvedByName: string;
  approvedByDesignation: string;
  approvedByDate: string;
}

const gunturApprovals = {
  preparedByName: "SI Venkata Suresh",
  preparedByDesignation: "Sub-Inspector, Traffic Investigation Wing, Guntur",
  verifiedByName: "DSP Lakshmi Narayana",
  verifiedByDesignation: "DSP Traffic, Guntur",
  approvedByName: "SP Arif Hafeez",
  approvedByDesignation: "Superintendent of Police, Guntur",
};

function causes(...items: string[]): CauseMap {
  return Object.fromEntries(items.map((item) => [item, true]));
}

const demoSubmissions: DemoSubmission[] = [
  {
    fir: "DEMO/GT/2026/001",
    place: "Near Pedakakani Toll Plaza, NH-16",
    mandal: "Pedakakani",
    policeStation: "Pedakakani",
    roadType: "NH",
    accidentDate: "2026-01-04",
    accidentTime: "05:40",
    latLong: "16.3521, 80.5437",
    personsDied: 2,
    personsInjured: 3,
    vehicles: [
      { registration_number: "AP07 TZ 4521", class_type: "Heavy Goods Vehicle (Truck)" },
      { registration_number: "AP16 CK 1189", class_type: "Motor Car (Sedan)" },
    ],
    drivers: [
      { name: "Ramesh Kumar", dl_number: "AP0720190045678", licensing_authority: "RTA Guntur" },
      { name: "Manoj Varma", dl_number: "AP1620210032456", licensing_authority: "RTA Bapatla" },
    ],
    driverCauses: causes(
      "The driver was over speeding.",
      "Driver slept while driving.",
      "Driver did not have proper rest / accident happened due to driver fatigue."
    ),
    vehicleCauses: causes(
      "The tyres were not in proper shape / worn out.",
      "The status of Speed Limiting devices."
    ),
    roadNature: causes("Black Spot."),
    roadJunctions: causes("Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways."),
    roadSignages: causes(
      "No proper signages in the accident area.",
      "The illumination at the sight is not proper."
    ),
    roadMedian: causes("Improper median."),
    roadCulverts: {},
    preparedByDate: "2026-01-05",
    verifiedByDate: "2026-01-06",
    approvedByDate: "2026-01-07",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/002",
    place: "Nallapadu Junction Service Road Merge",
    mandal: "Guntur",
    policeStation: "Nallapadu",
    roadType: "Other",
    accidentDate: "2026-01-08",
    accidentTime: "18:25",
    latLong: "16.2826, 80.4213",
    personsDied: 1,
    personsInjured: 4,
    vehicles: [
      { registration_number: "AP07 DF 2244", class_type: "Auto Rickshaw" },
      { registration_number: "AP07 BU 9981", class_type: "Mini Lorry" },
    ],
    drivers: [
      { name: "P. Chandra", dl_number: "AP0720200011299", licensing_authority: "RTA Guntur" },
      { name: "Sk. Karimulla", dl_number: "AP0720180044108", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The vehicle was being driven in the wrong direction.",
      "Driver made an error of judgment during overtaking."
    ),
    vehicleCauses: causes("The braking distance was not sufficient."),
    roadNature: causes("Industrial / Institutional area."),
    roadJunctions: causes("Due to X - Junction / cross road without scientific merging of roads."),
    roadSignages: causes(
      "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.",
      "Merging / diverging of small / arterial roads from the main road."
    ),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-01-09",
    verifiedByDate: "2026-01-10",
    approvedByDate: "2026-01-11",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/003",
    place: "Mangalagiri Town Bus Stand Stretch",
    mandal: "Mangalagiri",
    policeStation: "Mangalagiri Town",
    roadType: "SH",
    accidentDate: "2026-01-12",
    accidentTime: "20:10",
    latLong: "16.4302, 80.5685",
    personsDied: 1,
    personsInjured: 6,
    vehicles: [
      { registration_number: "AP07 Z 7711", class_type: "RTC Bus" },
      { registration_number: "AP07 CM 2145", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "B. Srinivas", dl_number: "AP0720170067821", licensing_authority: "RTA Guntur" },
      { name: "K. Teja", dl_number: "AP0720220088304", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was over speeding.",
      "The driver made an error of judgment of the position of the other vehicle."
    ),
    vehicleCauses: causes("The vehicle lights and indicators not working."),
    roadNature: causes("Village area i.e. highway is passing through the habituated area."),
    roadJunctions: causes("Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction."),
    roadSignages: causes("No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road."),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-01-13",
    verifiedByDate: "2026-01-14",
    approvedByDate: "2026-01-15",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/004",
    place: "Tadepalli Service Road near Undavalli Junction",
    mandal: "Tadepalli",
    policeStation: "Tadepalli",
    roadType: "Other",
    accidentDate: "2026-01-16",
    accidentTime: "22:35",
    latLong: "16.4864, 80.6021",
    personsDied: 2,
    personsInjured: 2,
    vehicles: [
      { registration_number: "AP39 GH 4567", class_type: "SUV" },
      { registration_number: "AP07 RT 7755", class_type: "Goods Carrier (Mini Truck)" },
    ],
    drivers: [
      { name: "N. Avinash", dl_number: "AP3920190034561", licensing_authority: "RTA NTR" },
      { name: "Y. Dinesh", dl_number: "AP0720180017744", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was under the influence of alcohol at the time of accident.",
      "The vehicle is parked wrongly on the road."
    ),
    vehicleCauses: causes("The braking system failed."),
    roadNature: causes("Blind Spot."),
    roadJunctions: causes("Absence of Traffic round about or improper traffic roundabouts."),
    roadSignages: causes("The illumination at the sight is not proper."),
    roadMedian: causes("Broken median."),
    roadCulverts: {},
    preparedByDate: "2026-01-17",
    verifiedByDate: "2026-01-18",
    approvedByDate: "2026-01-19",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/005",
    place: "Amaravathi Road near Medical College Curve",
    mandal: "Amaravathi",
    policeStation: "Amaravathi",
    roadType: "MDR",
    accidentDate: "2026-01-20",
    accidentTime: "07:05",
    latLong: "16.5718, 80.3572",
    personsDied: 1,
    personsInjured: 3,
    vehicles: [
      { registration_number: "AP07 JH 3021", class_type: "College Bus" },
      { registration_number: "AP07 BP 8812", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "T. Dharma", dl_number: "AP0720160023310", licensing_authority: "RTA Guntur" },
      { name: "M. Vijay", dl_number: "AP0720210099432", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was over speeding.",
      "The vehicle was over loaded with goods / passengers."
    ),
    vehicleCauses: {},
    roadNature: causes("School / College area."),
    roadJunctions: {},
    roadSignages: causes(
      "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot."
    ),
    roadMedian: {},
    roadCulverts: causes("Curving at the accident spot is very sharp."),
    preparedByDate: "2026-01-21",
    verifiedByDate: "2026-01-22",
    approvedByDate: "2026-01-23",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/006",
    place: "Tenali Railway Station Road Crossing",
    mandal: "Tenali",
    policeStation: "Tenali I Town",
    roadType: "Other",
    accidentDate: "2026-01-24",
    accidentTime: "09:50",
    latLong: "16.2390, 80.6438",
    personsDied: 0,
    personsInjured: 5,
    vehicles: [
      { registration_number: "AP26 TA 6631", class_type: "Passenger Auto" },
      { registration_number: "AP07 NN 2100", class_type: "Delivery Van" },
    ],
    drivers: [
      { name: "B. Nagesh", dl_number: "AP2620200076542", licensing_authority: "RTA Bapatla" },
      { name: "V. Nagaraju", dl_number: "AP0720180062300", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes("Driver made an error of judgment during overtaking."),
    vehicleCauses: causes("The tyres were not in proper shape / worn out."),
    roadNature: causes("Pilgrim centre / shandy."),
    roadJunctions: causes("Railway Crossing."),
    roadSignages: causes("Signages are erected but not in proper shape / visibility."),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-01-25",
    verifiedByDate: "2026-01-26",
    approvedByDate: "2026-01-27",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/007",
    place: "Narasaraopet Ring Road Entry Point",
    mandal: "Narasaraopet",
    policeStation: "Narasaraopet Rural",
    roadType: "SH",
    accidentDate: "2026-01-28",
    accidentTime: "16:45",
    latLong: "16.2360, 80.0471",
    personsDied: 3,
    personsInjured: 2,
    vehicles: [
      { registration_number: "AP39 KT 7120", class_type: "Private Bus" },
      { registration_number: "AP07 QR 1194", class_type: "Two Wheeler (Scooter)" },
    ],
    drivers: [
      { name: "R. Mahesh", dl_number: "AP3920180081123", licensing_authority: "RTA NTR" },
      { name: "A. Nagamani", dl_number: "AP0720210013378", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was over speeding.",
      "The vehicle lights and indicators not working."
    ),
    vehicleCauses: causes("Fitness of the vehicle expired / was not valid at the time of accident."),
    roadNature: causes("Village area i.e. highway is passing through the habituated area."),
    roadJunctions: causes("Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction."),
    roadSignages: causes("No proper signages in the accident area."),
    roadMedian: causes("Absence of Median."),
    roadCulverts: {},
    preparedByDate: "2026-01-29",
    verifiedByDate: "2026-01-30",
    approvedByDate: "2026-01-31",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/008",
    place: "Sattenapalli Town Market Road",
    mandal: "Sattenapalli",
    policeStation: "Sattenapalli Town",
    roadType: "Other",
    accidentDate: "2026-02-02",
    accidentTime: "11:30",
    latLong: "16.3936, 80.1489",
    personsDied: 1,
    personsInjured: 2,
    vehicles: [
      { registration_number: "AP07 AA 3210", class_type: "Tractor with Trailer" },
      { registration_number: "AP07 DD 2211", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "Sk. Baji", dl_number: "AP0720170077412", licensing_authority: "RTA Guntur" },
      { name: "P. Hemanth", dl_number: "AP0720230021992", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver is having a D.L but not authorised to drive the vehicle involved in the accident.",
      "The vehicle was over loaded with goods / passengers."
    ),
    vehicleCauses: causes("Over projection of body / load obstructing the view of traffic ahead."),
    roadNature: causes("Pilgrim centre / shandy."),
    roadJunctions: {},
    roadSignages: causes("Hoardings / billboards at the site are attention distracting."),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-02-03",
    verifiedByDate: "2026-02-04",
    approvedByDate: "2026-02-05",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/009",
    place: "Piduguralla Limestone Plant Access Road",
    mandal: "Piduguralla",
    policeStation: "Piduguralla",
    roadType: "MDR",
    accidentDate: "2026-02-06",
    accidentTime: "14:20",
    latLong: "16.4843, 79.8931",
    personsDied: 2,
    personsInjured: 1,
    vehicles: [
      { registration_number: "AP07 TR 8821", class_type: "Tipper Lorry" },
      { registration_number: "TS08 AQ 1199", class_type: "Motor Car (Hatchback)" },
    ],
    drivers: [
      { name: "K. Venkateswarlu", dl_number: "AP0720150039320", licensing_authority: "RTA Guntur" },
      { name: "M. Arjun", dl_number: "TS0820200067765", licensing_authority: "RTA Hyderabad" },
    ],
    driverCauses: causes(
      "The driver was over speeding.",
      "The driver made an error of judgment of the position of the other vehicle."
    ),
    vehicleCauses: causes("The braking system failed."),
    roadNature: causes("Industrial / Institutional area."),
    roadJunctions: causes("Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways."),
    roadSignages: causes("No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads."),
    roadMedian: {},
    roadCulverts: causes("The width of the road / culvert / bridge is not proper."),
    preparedByDate: "2026-02-07",
    verifiedByDate: "2026-02-08",
    approvedByDate: "2026-02-09",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/010",
    place: "Near Pedakakani Toll Plaza, NH-16",
    mandal: "Pedakakani",
    policeStation: "Pedakakani",
    roadType: "NH",
    accidentDate: "2026-02-10",
    accidentTime: "01:15",
    latLong: "16.3519, 80.5444",
    personsDied: 4,
    personsInjured: 1,
    vehicles: [
      { registration_number: "AP07 X 8831", class_type: "Container Truck" },
      { registration_number: "AP07 FH 2198", class_type: "Mini Van (Passenger)" },
    ],
    drivers: [
      { name: "D. Basha", dl_number: "AP0720140068801", licensing_authority: "RTA Guntur" },
      { name: "T. Raghu", dl_number: "AP0720200038191", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "Driver slept while driving.",
      "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs."
    ),
    vehicleCauses: causes(
      "The tyres were not in proper shape / worn out.",
      "The status of GPS."
    ),
    roadNature: causes("Black Spot."),
    roadJunctions: {},
    roadSignages: causes(
      "No proper signages in the accident area.",
      "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot."
    ),
    roadMedian: causes("Improper median."),
    roadCulverts: {},
    preparedByDate: "2026-02-11",
    verifiedByDate: "2026-02-12",
    approvedByDate: "2026-02-13",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/011",
    place: "Guntur Inner Ring near Nallapadu Flyover",
    mandal: "Guntur",
    policeStation: "Nallapadu",
    roadType: "Other",
    accidentDate: "2026-02-13",
    accidentTime: "17:55",
    latLong: "16.2948, 80.4201",
    personsDied: 0,
    personsInjured: 4,
    vehicles: [
      { registration_number: "AP07 HM 5060", class_type: "Water Tanker" },
      { registration_number: "AP07 LK 1010", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "Y. Ravi", dl_number: "AP0720160088112", licensing_authority: "RTA Guntur" },
      { name: "G. Sasi", dl_number: "AP0720220067111", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The vehicle was being driven in the wrong direction.",
      "The driver made an error of judgment of the position of the other vehicle."
    ),
    vehicleCauses: {},
    roadNature: causes("Industrial / Institutional area."),
    roadJunctions: causes("Due to X - Junction / cross road without scientific merging of roads."),
    roadSignages: causes("Merging / diverging of small / arterial roads from the main road."),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-02-14",
    verifiedByDate: "2026-02-15",
    approvedByDate: "2026-02-16",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/012",
    place: "Tenali Rural Canal Bund Road",
    mandal: "Tenali",
    policeStation: "Tenali Rural",
    roadType: "MDR",
    accidentDate: "2026-02-16",
    accidentTime: "06:25",
    latLong: "16.2214, 80.6610",
    personsDied: 2,
    personsInjured: 2,
    vehicles: [
      { registration_number: "AP07 PV 0091", class_type: "Milk Van" },
      { registration_number: "AP07 CT 7144", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "P. Vasu", dl_number: "AP0720180061220", licensing_authority: "RTA Guntur" },
      { name: "M. Koteswara Rao", dl_number: "AP0720170079234", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was over speeding.",
      "Driver did not have proper rest / accident happened due to driver fatigue."
    ),
    vehicleCauses: causes("The vehicle engine was faulty."),
    roadNature: causes("Village area i.e. highway is passing through the habituated area."),
    roadJunctions: {},
    roadSignages: causes("The illumination at the sight is not proper."),
    roadMedian: {},
    roadCulverts: causes("Curving at the accident spot is very sharp."),
    preparedByDate: "2026-02-17",
    verifiedByDate: "2026-02-18",
    approvedByDate: "2026-02-19",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/013",
    place: "Mangalagiri Rural bypass median opening",
    mandal: "Mangalagiri",
    policeStation: "Mangalagiri Rural",
    roadType: "NH",
    accidentDate: "2026-02-19",
    accidentTime: "13:40",
    latLong: "16.4527, 80.5758",
    personsDied: 1,
    personsInjured: 5,
    vehicles: [
      { registration_number: "AP07 HB 4477", class_type: "School Bus" },
      { registration_number: "AP39 MP 7780", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "J. Bhaskar", dl_number: "AP0720150008821", licensing_authority: "RTA Guntur" },
      { name: "C. Phani", dl_number: "AP3920220044891", licensing_authority: "RTA NTR" },
    ],
    driverCauses: causes(
      "The driver made an error of judgment during overtaking.",
      "The vehicle was over loaded with goods / passengers."
    ),
    vehicleCauses: causes("The braking distance was not sufficient."),
    roadNature: causes("School / College area."),
    roadJunctions: {},
    roadSignages: causes("No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road."),
    roadMedian: causes("Broken median."),
    roadCulverts: {},
    preparedByDate: "2026-02-20",
    verifiedByDate: "2026-02-21",
    approvedByDate: "2026-02-22",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/014",
    place: "Narasaraopet Trafic PS Circle Road",
    mandal: "Narasaraopet",
    policeStation: "Narasaraopet Trafic PS",
    roadType: "Other",
    accidentDate: "2026-02-22",
    accidentTime: "19:05",
    latLong: "16.2341, 80.0508",
    personsDied: 1,
    personsInjured: 3,
    vehicles: [
      { registration_number: "AP07 RS 5610", class_type: "Passenger Auto" },
      { registration_number: "AP07 SS 7814", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "K. Appa Rao", dl_number: "AP0720190045523", licensing_authority: "RTA Guntur" },
      { name: "D. Lalith", dl_number: "AP0720230051180", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was under the influence of alcohol at the time of accident.",
      "The driver made an error of judgment of the position of the other vehicle."
    ),
    vehicleCauses: {},
    roadNature: causes("Pilgrim centre / shandy."),
    roadJunctions: causes("Absence of Traffic round about or improper traffic roundabouts."),
    roadSignages: causes("Signages are erected but not in proper shape / visibility."),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-02-23",
    verifiedByDate: "2026-02-24",
    approvedByDate: "2026-02-25",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/015",
    place: "Sattenapalli Rural canal bridge approach",
    mandal: "Sattenapalli",
    policeStation: "Sattenapalli Rural",
    roadType: "MDR",
    accidentDate: "2026-02-25",
    accidentTime: "03:55",
    latLong: "16.4035, 80.1380",
    personsDied: 3,
    personsInjured: 1,
    vehicles: [
      { registration_number: "AP07 ZZ 9912", class_type: "Sand Lorry" },
      { registration_number: "AP07 JM 7742", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "M. Subba Rao", dl_number: "AP0720140036671", licensing_authority: "RTA Guntur" },
      { name: "A. Kiran", dl_number: "AP0720210090012", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was over speeding.",
      "Driver slept while driving."
    ),
    vehicleCauses: causes("The tyres were not in proper shape / worn out."),
    roadNature: causes("Blind Spot."),
    roadJunctions: {},
    roadSignages: causes(
      "No proper signages in the accident area.",
      "The illumination at the sight is not proper."
    ),
    roadMedian: {},
    roadCulverts: causes(
      "Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge."
    ),
    preparedByDate: "2026-02-26",
    verifiedByDate: "2026-02-27",
    approvedByDate: "2026-02-28",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/016",
    place: "Near Pedakakani Toll Plaza, NH-16",
    mandal: "Pedakakani",
    policeStation: "Pedakakani",
    roadType: "NH",
    accidentDate: "2026-03-02",
    accidentTime: "23:20",
    latLong: "16.3525, 80.5432",
    personsDied: 2,
    personsInjured: 4,
    vehicles: [
      { registration_number: "KA51 TR 4401", class_type: "Trailer Truck" },
      { registration_number: "AP07 CN 7719", class_type: "Tourist Car" },
    ],
    drivers: [
      { name: "S. Kareem", dl_number: "KA5120160044470", licensing_authority: "RTO Bengaluru" },
      { name: "P. Lokesh", dl_number: "AP0720200022214", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The vehicle was being driven in the wrong direction.",
      "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs."
    ),
    vehicleCauses: causes(
      "The status of GPS.",
      "The status of Speed Limiting devices."
    ),
    roadNature: causes("Black Spot."),
    roadJunctions: {},
    roadSignages: causes("No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road."),
    roadMedian: causes("Improper median."),
    roadCulverts: {},
    preparedByDate: "2026-03-03",
    verifiedByDate: "2026-03-04",
    approvedByDate: "2026-03-05",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/017",
    place: "Tadepalli Service Road near Undavalli Junction",
    mandal: "Tadepalli",
    policeStation: "Tadepalli",
    roadType: "Other",
    accidentDate: "2026-03-05",
    accidentTime: "08:35",
    latLong: "16.4868, 80.6017",
    personsDied: 0,
    personsInjured: 6,
    vehicles: [
      { registration_number: "AP07 TU 6612", class_type: "Employee Bus" },
      { registration_number: "AP39 AC 0027", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "D. Sreenivasulu", dl_number: "AP0720180065530", licensing_authority: "RTA Guntur" },
      { name: "V. Harish", dl_number: "AP3920220071281", licensing_authority: "RTA NTR" },
    ],
    driverCauses: causes(
      "The driver made an error of judgment during overtaking.",
      "The vehicle lights and indicators not working."
    ),
    vehicleCauses: causes("The braking distance was not sufficient."),
    roadNature: causes("School / College area."),
    roadJunctions: causes("Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction."),
    roadSignages: causes("Merging / diverging of small / arterial roads from the main road."),
    roadMedian: causes("Broken median."),
    roadCulverts: {},
    preparedByDate: "2026-03-06",
    verifiedByDate: "2026-03-07",
    approvedByDate: "2026-03-08",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/018",
    place: "Nallapadu Junction Service Road Merge",
    mandal: "Guntur",
    policeStation: "Nallapadu",
    roadType: "Other",
    accidentDate: "2026-03-08",
    accidentTime: "21:40",
    latLong: "16.2831, 80.4219",
    personsDied: 2,
    personsInjured: 2,
    vehicles: [
      { registration_number: "AP07 HG 6744", class_type: "Pickup Van" },
      { registration_number: "AP07 JE 7712", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "C. Rajasekhar", dl_number: "AP0720170058810", licensing_authority: "RTA Guntur" },
      { name: "M. Santhosh", dl_number: "AP0720220043388", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver was under the influence of alcohol at the time of accident.",
      "The vehicle is parked wrongly on the road."
    ),
    vehicleCauses: causes("The braking system failed."),
    roadNature: causes("Industrial / Institutional area."),
    roadJunctions: causes("Due to X - Junction / cross road without scientific merging of roads."),
    roadSignages: causes(
      "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.",
      "The illumination at the sight is not proper."
    ),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-03-09",
    verifiedByDate: "2026-03-10",
    approvedByDate: "2026-03-11",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/019",
    place: "Amaravathi Seed Access Road bridge approach",
    mandal: "Amaravathi",
    policeStation: "Amaravathi",
    roadType: "MDR",
    accidentDate: "2026-03-12",
    accidentTime: "15:15",
    latLong: "16.5694, 80.3605",
    personsDied: 1,
    personsInjured: 3,
    vehicles: [
      { registration_number: "AP07 GF 2121", class_type: "Agriculture Tractor" },
      { registration_number: "AP07 VV 8820", class_type: "Motorcycle" },
    ],
    drivers: [
      { name: "T. Yesu Babu", dl_number: "AP0720190031188", licensing_authority: "RTA Guntur" },
      { name: "G. Chaitanya", dl_number: "AP0720230091910", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "The driver is not having any driving licence.",
      "The vehicle was over loaded with goods / passengers."
    ),
    vehicleCauses: causes("Over projection of body / load obstructing the view of traffic ahead."),
    roadNature: causes("Village area i.e. highway is passing through the habituated area."),
    roadJunctions: {},
    roadSignages: causes("No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads."),
    roadMedian: {},
    roadCulverts: causes("Culvert / bridge at the accident spot."),
    preparedByDate: "2026-03-13",
    verifiedByDate: "2026-03-14",
    approvedByDate: "2026-03-15",
    ...gunturApprovals,
  },
  {
    fir: "DEMO/GT/2026/020",
    place: "Tenali II Town market junction",
    mandal: "Tenali",
    policeStation: "Tenali II Town",
    roadType: "Other",
    accidentDate: "2026-03-15",
    accidentTime: "18:10",
    latLong: "16.2449, 80.6407",
    personsDied: 1,
    personsInjured: 5,
    vehicles: [
      { registration_number: "AP07 PQ 1188", class_type: "City Bus" },
      { registration_number: "AP07 XY 5510", class_type: "Passenger Auto" },
    ],
    drivers: [
      { name: "N. Prasad", dl_number: "AP0720160092231", licensing_authority: "RTA Guntur" },
      { name: "Shaik Imran", dl_number: "AP0720210017844", licensing_authority: "RTA Guntur" },
    ],
    driverCauses: causes(
      "Driver made an error of judgment during overtaking.",
      "The driver made an error of judgment of the position of the other vehicle."
    ),
    vehicleCauses: causes("The vehicle lights and indicators not working."),
    roadNature: causes("Pilgrim centre / shandy."),
    roadJunctions: causes("Absence of Traffic round about or improper traffic roundabouts."),
    roadSignages: causes("Signages are erected but not in proper shape / visibility."),
    roadMedian: {},
    roadCulverts: {},
    preparedByDate: "2026-03-16",
    verifiedByDate: "2026-03-17",
    approvedByDate: "2026-03-18",
    ...gunturApprovals,
  },
];
async function seedDemoSubmissions() {
  console.log("Seeding 20 Guntur demo submissions...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT u.id
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.email = 'guntur' AND p.district = 'Guntur'
       LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      throw new Error("Guntur user not found. Run 'npm run seed' in the server folder first.");
    }

    const userId = userResult.rows[0].id as string;

    await client.query(
      "DELETE FROM accident_submissions WHERE user_id = $1 AND fir_number LIKE 'DEMO/GT/%'",
      [userId]
    );

    for (const item of demoSubmissions) {
      await client.query(
        `INSERT INTO accident_submissions (
          user_id, district, place_of_accident, mandal, police_station, fir_number,
          road_type, accident_date, accident_time, lat_long,
          persons_died, persons_injured, vehicles, drivers,
          driver_related_causes, vehicle_condition_causes,
          road_engineering_nature, road_engineering_junctions, road_engineering_signages,
          road_engineering_median, road_engineering_culverts,
          prepared_by_name, prepared_by_designation, prepared_by_date,
          verified_by_name, verified_by_designation, verified_by_date,
          approved_by_name, approved_by_designation, approved_by_date
        ) VALUES (
          $1, 'Guntur', $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12::jsonb, $13::jsonb,
          $14::jsonb, $15::jsonb,
          $16::jsonb, $17::jsonb, $18::jsonb,
          $19::jsonb, $20::jsonb,
          $21, $22, $23,
          $24, $25, $26,
          $27, $28, $29
        )`,
        [
          userId,
          item.place,
          item.mandal,
          item.policeStation,
          item.fir,
          item.roadType,
          item.accidentDate,
          item.accidentTime,
          item.latLong,
          item.personsDied,
          item.personsInjured,
          JSON.stringify(item.vehicles),
          JSON.stringify(item.drivers),
          JSON.stringify(item.driverCauses),
          JSON.stringify(item.vehicleCauses),
          JSON.stringify(item.roadNature),
          JSON.stringify(item.roadJunctions),
          JSON.stringify(item.roadSignages),
          JSON.stringify(item.roadMedian),
          JSON.stringify(item.roadCulverts),
          item.preparedByName,
          item.preparedByDesignation,
          item.preparedByDate,
          item.verifiedByName,
          item.verifiedByDesignation,
          item.verifiedByDate,
          item.approvedByName,
          item.approvedByDesignation,
          item.approvedByDate,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Inserted 20 Guntur demo submissions successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Demo submission seed failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoSubmissions();
