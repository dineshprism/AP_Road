import pool from "../../../src/db.js";

type CauseMap = Record<string, boolean>;

const PRISM_DEMOS = [
  {
    sdpo: "North SDPO",
    policeStation: "Prism North Town PS",
    mandal: "Prism North Urban",
    place: "Prism Ring Road Cloverleaf Junction",
    fir: "PRISM/2026/001",
    roadType: "NH",
    accidentDate: "2026-02-03",
    accidentTime: "08:20",
    latLong: "17.4521, 78.5124",
    died: 1,
    injured: 3,
  },
  {
    sdpo: "North SDPO",
    policeStation: "Prism North Traffic PS",
    mandal: "Prism North Urban",
    place: "North Freight Corridor Service Road Merge",
    fir: "PRISM/2026/002",
    roadType: "SH",
    accidentDate: "2026-02-11",
    accidentTime: "19:05",
    latLong: "17.4582, 78.5217",
    died: 0,
    injured: 2,
  },
  {
    sdpo: "South SDPO",
    policeStation: "Prism South Town PS",
    mandal: "Prism South",
    place: "Old Market Cross Four Roads",
    fir: "PRISM/2026/003",
    roadType: "MDR",
    accidentDate: "2026-02-18",
    accidentTime: "17:40",
    latLong: "17.4018, 78.4981",
    died: 2,
    injured: 4,
  },
  {
    sdpo: "South SDPO",
    policeStation: "Prism South Rural PS",
    mandal: "Prism South Rural",
    place: "Canal Bund Blind Curve near Mile 7",
    fir: "PRISM/2026/004",
    roadType: "Other",
    accidentDate: "2026-02-24",
    accidentTime: "06:55",
    latLong: "17.3894, 78.4729",
    died: 1,
    injured: 1,
  },
  {
    sdpo: "East SDPO",
    policeStation: "Prism East Town PS",
    mandal: "Prism East",
    place: "IT Park Elevated Ramp Exit",
    fir: "PRISM/2026/005",
    roadType: "NH",
    accidentDate: "2026-03-02",
    accidentTime: "21:10",
    latLong: "17.4811, 78.5562",
    died: 0,
    injured: 5,
  },
  {
    sdpo: "East SDPO",
    policeStation: "Prism East Rural PS",
    mandal: "Prism East Rural",
    place: "Dry Port Link Road T-Junction",
    fir: "PRISM/2026/006",
    roadType: "SH",
    accidentDate: "2026-03-09",
    accidentTime: "13:15",
    latLong: "17.4927, 78.5741",
    died: 3,
    injured: 2,
  },
  {
    sdpo: "West SDPO",
    policeStation: "Prism West Town PS",
    mandal: "Prism West",
    place: "Industrial Estate Gate No. 2",
    fir: "PRISM/2026/007",
    roadType: "MDR",
    accidentDate: "2026-03-14",
    accidentTime: "15:35",
    latLong: "17.4366, 78.4415",
    died: 0,
    injured: 1,
  },
  {
    sdpo: "West SDPO",
    policeStation: "Prism West Traffic PS",
    mandal: "Prism West",
    place: "Outer Bypass Rotary Junction",
    fir: "PRISM/2026/008",
    roadType: "NH",
    accidentDate: "2026-03-20",
    accidentTime: "22:25",
    latLong: "17.4298, 78.4332",
    died: 2,
    injured: 6,
  },
  {
    sdpo: "Centre SDPO",
    policeStation: "Prism Centre Town PS",
    mandal: "Prism Central",
    place: "Collectorate Signal Intersection",
    fir: "PRISM/2026/009",
    roadType: "SH",
    accidentDate: "2026-03-25",
    accidentTime: "11:50",
    latLong: "17.4455, 78.4876",
    died: 1,
    injured: 2,
  },
  {
    sdpo: "Centre SDPO",
    policeStation: "Prism Centre Control Room PS",
    mandal: "Prism Central",
    place: "Central Bus Terminal Slip Lane",
    fir: "PRISM/2026/010",
    roadType: "Other",
    accidentDate: "2026-03-27",
    accidentTime: "18:45",
    latLong: "17.4471, 78.4918",
    died: 0,
    injured: 7,
  },
  {
    sdpo: "Mahila SDPO",
    policeStation: "Prism Mahila PS",
    mandal: "Prism Central",
    place: "Women University Main Gate Road",
    fir: "PRISM/2026/011",
    roadType: "MDR",
    accidentDate: "2026-03-29",
    accidentTime: "09:10",
    latLong: "17.4543, 78.5037",
    died: 0,
    injured: 2,
  },
  {
    sdpo: "Mahila SDPO",
    policeStation: "Prism SHE Team PS",
    mandal: "Prism East",
    place: "Lake View Pedestrian Crossing",
    fir: "PRISM/2026/012",
    roadType: "Other",
    accidentDate: "2026-04-01",
    accidentTime: "20:05",
    latLong: "17.4664, 78.5488",
    died: 1,
    injured: 1,
  },
] as const;

const DRIVER_RELATED_CAUSES = [
  "The driver was over speeding.",
  "The vehicle was being driven in the wrong direction.",
  "Driver made an error of judgment during overtaking.",
  "Driver slept while driving.",
  "The driver was under the influence of alcohol at the time of accident.",
  "Driver did not have proper rest / accident happened due to driver fatigue.",
];

const VEHICLE_CONDITION_CAUSES = [
  "The braking system failed.",
  "The tyres were not in proper shape / worn out.",
  "The vehicle engine was faulty.",
  "The braking distance was not sufficient.",
];

const ROAD_NATURE_CAUSES = [
  "Black Spot.",
  "Blind Spot.",
  "Industrial / Institutional area.",
  "Village area i.e. highway is passing through the habituated area.",
];

const ROAD_JUNCTIONS_CAUSES = [
  "Due to X - Junction / cross road without scientific merging of roads.",
  "Absence of Traffic round about or improper traffic roundabouts.",
  "Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways.",
];

const ROAD_SIGNAGES_CAUSES = [
  "No proper signages in the accident area.",
  "The illumination at the sight is not proper.",
  "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.",
];

const ROAD_MEDIAN_CAUSES = [
  "Improper median.",
  "Broken median.",
  "Absence of Median.",
];

const ROAD_CULVERTS_CAUSES = [
  "Curving at the accident spot is very sharp.",
  "The width of the road / culvert / bridge is not proper.",
];

function boolMap(...values: string[]): CauseMap {
  return Object.fromEntries(values.map((value) => [value, true]));
}

function makeVehicles(index: number) {
  return [
    {
      registration_number: `AP39 PR ${String(2100 + index).padStart(4, "0")}`,
      class_type: index % 2 === 0 ? "Motor Car" : "Motorcycle",
    },
    {
      registration_number: `AP39 TG ${String(5100 + index).padStart(4, "0")}`,
      class_type: index % 3 === 0 ? "Goods Carrier" : "Bus",
    },
  ];
}

function makeDrivers(index: number) {
  return [
    {
      name: `Prism Driver ${index + 1}A`,
      dl_number: `AP392026${String(700100 + index).slice(-6)}`,
      licensing_authority: "RTA Prism",
    },
    {
      name: `Prism Driver ${index + 1}B`,
      dl_number: `AP392026${String(800100 + index).slice(-6)}`,
      licensing_authority: "RTA Prism",
    },
  ];
}

async function seedPrismDemoSubmissions() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const prismUserResult = await client.query<{ user_id: string }>(
      `SELECT u.id AS user_id
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       WHERE u.email = 'prism' AND p.district = 'Prism'
       LIMIT 1`
    );

    const prismUserId = prismUserResult.rows[0]?.user_id;
    if (!prismUserId) {
      throw new Error("Prism user not found. Seed users first.");
    }

    await client.query(
      "DELETE FROM accident_submissions WHERE user_id = $1 OR district = 'Prism'",
      [prismUserId]
    );

    for (const [index, demo] of PRISM_DEMOS.entries()) {
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
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13::jsonb, $14::jsonb,
          $15::jsonb, $16::jsonb,
          $17::jsonb, $18::jsonb, $19::jsonb,
          $20::jsonb, $21::jsonb,
          $22, $23, $24,
          $25, $26, $27,
          $28, $29, $30
        )`,
        [
          prismUserId,
          "Prism",
          demo.place,
          demo.mandal,
          demo.policeStation,
          demo.fir,
          demo.roadType,
          demo.accidentDate,
          demo.accidentTime,
          demo.latLong,
          demo.died,
          demo.injured,
          JSON.stringify(makeVehicles(index)),
          JSON.stringify(makeDrivers(index)),
          JSON.stringify(boolMap(DRIVER_RELATED_CAUSES[index % DRIVER_RELATED_CAUSES.length]!, DRIVER_RELATED_CAUSES[(index + 2) % DRIVER_RELATED_CAUSES.length]!)),
          JSON.stringify(boolMap(VEHICLE_CONDITION_CAUSES[index % VEHICLE_CONDITION_CAUSES.length]!)),
          JSON.stringify(boolMap(ROAD_NATURE_CAUSES[index % ROAD_NATURE_CAUSES.length]!)),
          JSON.stringify(boolMap(ROAD_JUNCTIONS_CAUSES[index % ROAD_JUNCTIONS_CAUSES.length]!)),
          JSON.stringify(boolMap(ROAD_SIGNAGES_CAUSES[index % ROAD_SIGNAGES_CAUSES.length]!)),
          JSON.stringify(boolMap(ROAD_MEDIAN_CAUSES[index % ROAD_MEDIAN_CAUSES.length]!)),
          JSON.stringify(boolMap(ROAD_CULVERTS_CAUSES[index % ROAD_CULVERTS_CAUSES.length]!)),
          `Prism SI ${index + 1}`,
          `${demo.sdpo} Field Officer`,
          demo.accidentDate,
          `Prism DSP ${index + 1}`,
          `${demo.sdpo} Review Officer`,
          demo.accidentDate,
          `Prism SP ${index + 1}`,
          "Prism District Approval Authority",
          demo.accidentDate,
        ]
      );
    }

    await client.query("COMMIT");
    console.log(`Inserted ${PRISM_DEMOS.length} demo submissions for Prism.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Prism demo seed failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedPrismDemoSubmissions();
