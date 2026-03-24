import pool from "../../../src/db.js";

type CauseMap = Record<string, boolean>;

const ROAD_TYPES = ["NH", "SH", "MDR", "Other"] as const;
const LOCATION_SUFFIXES = [
  "Junction",
  "Bypass Stretch",
  "Market Road",
  "Service Road Merge",
  "Bridge Approach",
] as const;

const DISTRICT_STATIONS: Record<string, string[]> = {
  "Alluri Sitharama Raju": ["Addateegala", "Devipatnam", "Dutcherthi", "Gangavaram", "Gurthedu"],
  "Anakapalli": ["A.Koduru", "Anakapalli Rural", "Anakapalli Town", "Anakapalli Traffic", "Butchiyyapeta"],
  "Anantapur": ["Anantapur I Town", "Anantapur II Town", "Anantapur III Town", "Anantapur IV Town", "Anantapur Rural"],
  "Bapatla": ["Adavuladeevi", "Amruthalur", "Bhattiprole", "Cherukupalli", "Kolluru"],
  "Chittoor": ["Baireddypalle", "Bangarupalem UPS", "Chowdepalli", "Gangavaram UPS", "Palamaner UPS"],
  "East Godavari": ["Airport PS", "Gokavaram", "Korukonda", "Rajanagaram", "Seethanagaram"],
  "Eluru": ["Agiripalli", "Chatrai", "Denduluru", "Musunuru", "Nuzvid Rural"],
  "Guntur": ["Arundalpet", "Nagarampalem", "Pattabhipuram", "CCS , Guntur", "Guntur Traffic"],
  "Kakinada": ["Annavaram", "Gandepalli", "Jaggampeta", "Kirlampudi", "Kotananduru"],
  "Konaseema": ["Alamuru", "Ambajipeta", "Athreyapuram", "Inavilli", "Kothapeta"],
  "Krishna": ["Atkuru", "Gannavaram Traffic UPS", "Gannavaram UPS", "Hanuman Junction", "Kankipadu"],
  "Kurnool": ["Adoni I Town", "Adoni II Town", "Adoni III Town", "Adoni Rural", "Adoni Traffic"],
  "NTR": ["A. Konduru", "G. Konduru", "Gampalagudem", "Mylavaram", "Reddigudem"],
  "Nandyal": ["Allagadda Rural", "Allagadda Town", "Chagalamarri", "Dornipadu", "Koilakuntla"],
  "Nellore": ["A.S.Pet", "Ananthasagaram", "Atmakur", "Chejerla", "Kaluvoy"],
  "Palnadu": ["Amaravathi", "Atchampet", "Bellamkonda", "Krosuru", "Muppalla"],
  "Parvathipuram Manyam": ["Balijipeta", "Komarada", "Kotiya", "Makkuva", "Pachipenta"],
  "Prakasam": ["Ardhaveedu", "Besthavaripeta", "Cumbum", "Dornala", "Giddalur"],
  "Sri Sathya Sai": ["Agali", "Amarapuram", "Gorantla", "Gudibanda", "KIA PS"],
  "Srikakulam": ["Amadalavalasa", "Burja", "Etcherla", "G. Sigadam", "Gara"],
  "Tirupati": ["Airport", "Gajula mandyam", "Renigunta", "Yerpedu", "Alipiri"],
  "Visakhapatnam": ["Airport", "Duvvada", "Gajuwaka", "Gopalapatnam", "Harbour"],
  "Vizianagaram": ["Andra", "Badangi", "Bobbili Town", "Bobbili Traffic", "Bondapalli"],
  "West Godavari": ["Achanta", "Mogaltur", "Narasapuram Rural", "Narasapuram Town", "Palakollu Rural"],
  "YSR Kadapa": ["Atlur", "B.Kodur", "B.Matam", "Badvel", "Badvel Rural (Gopavaram)"],
};

const FIRST_NAMES = [
  "Ravi", "Suresh", "Lakshmi", "Prasad", "Kiran",
  "Teja", "Swathi", "Bhavani", "Naveen", "Deepika",
];

const LAST_NAMES = [
  "Kumar", "Rao", "Naidu", "Reddy", "Varma",
  "Devi", "Sai", "Babu", "Murthy", "Srinivas",
];

const DRIVER_RELATED_CAUSES = [
  "The driver is not having any driving licence.",
  "The driver is having a D.L but not authorised to drive the vehicle involved in the accident.",
  "The driver was under the influence of alcohol at the time of accident.",
  "Driver slept while driving.",
  "Driver did not have proper rest / accident happened due to driver fatigue.",
  "The driver was over speeding.",
  "The vehicle was over loaded with goods / passengers.",
  "Passengers were illicitly being carried in the goods vehicle.",
  "The vehicle lights and indicators not working.",
  "The vehicle was being driven in the wrong direction.",
  "The vehicle is parked wrongly on the road.",
  "Driver made an error of judgment during overtaking.",
  "There is no 2nd Driver, hence single driver is continuously driving beyond 8 hrs.",
  "The driver made an error of judgment of the position of the other vehicle.",
];

const VEHICLE_CONDITION_CAUSES = [
  "The braking system failed.",
  "The tyres were not in proper shape / worn out.",
  "The vehicle engine was faulty.",
  "Fitness of the vehicle expired / was not valid at the time of accident.",
  "Over projection of body / load obstructing the view of traffic ahead.",
  "The braking distance was not sufficient.",
  "The status of GPS.",
  "The status of Speed Limiting devices.",
];

const ROAD_CULVERTS_CAUSES = [
  "Curving at the accident spot is very sharp.",
  "Width of the Culvert / bridge at the accident spot is narrower than the road entering the bridge.",
  "Culvert / bridge at the accident spot.",
  "The width of the road / culvert / bridge is not proper.",
];

const ROAD_JUNCTIONS_CAUSES = [
  "Due to convergence of traffic at the Y - Junction. There are no scientific exit and entry at this junction.",
  "Due to convergence of traffic at the T - Junction. There are no scientific exit and entry at this junction.",
  "Due to X - Junction / cross road without scientific merging of roads.",
  "Absence of Traffic round about or improper traffic roundabouts.",
  "Railway Crossing.",
  "Road side amenities (ex Dhabha, Petrol Pump etc) improperly joined into the roads / highways.",
];

const ROAD_MEDIAN_CAUSES = [
  "Improper median.",
  "Broken median.",
  "Absence of Median.",
];

const ROAD_NATURE_CAUSES = [
  "Village area i.e. highway is passing through the habituated area.",
  "School / College area.",
  "Black Spot.",
  "Blind Spot.",
  "Pilgrim centre / shandy.",
  "Industrial / Institutional area.",
  "Truck / Bus lay bye.",
];

const ROAD_SIGNAGES_CAUSES = [
  "No proper signages in the accident area.",
  "Signages are erected but not in proper shape / visibility.",
  "No proper signages well before the designated area to caution the driver in advance about the oncoming changes in the road.",
  "No proper markings on the road in the approach area to caution the driver in advance about the oncoming changes in the road.",
  "Merging / diverging of small / arterial roads from the main road.",
  "No paved / cemented / blacktopped road shoulders on both sides of the road for both halves of the roads.",
  "Traffic calming / alerting measures like rumble strips / rumble barcodes / crash barriers / delineators on either side of the bridge or culvert not arranged before the spot.",
  "The illumination at the sight is not proper.",
  "Hoardings / billboards at the site are attention distracting.",
];

function districtCode(district: string): string {
  const letters = district.replace(/[^A-Za-z]/g, "").toUpperCase();
  return letters.slice(0, 3).padEnd(3, "X");
}

function cleanStationName(station: string): string {
  return station.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function pick<T>(items: T[], seed: number, count = 1): T[] {
  const result: T[] = [];
  for (let index = 0; index < count; index += 1) {
    result.push(items[(seed + index) % items.length]);
  }
  return result;
}

function causes(values: string[]): CauseMap {
  return Object.fromEntries(values.map((value) => [value, true]));
}

function makeDate(seed: number): string {
  const month = String((seed % 3) + 1).padStart(2, "0");
  const day = String(((seed * 3) % 26) + 1).padStart(2, "0");
  return `2026-${month}-${day}`;
}

function makeTime(seed: number): string {
  const hour = String((6 + seed * 3) % 24).padStart(2, "0");
  const minute = String((10 + seed * 7) % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function makeLatLong(seed: number): string {
  const lat = (13.2 + (seed % 20) * 0.17).toFixed(4);
  const lng = (77.8 + (seed % 20) * 0.21).toFixed(4);
  return `${lat}, ${lng}`;
}

function makeVehicles(districtCodeValue: string, seed: number) {
  return [
    {
      registration_number: `AP${String((seed % 37) + 1).padStart(2, "0")} ${districtCodeValue}${String(1000 + seed).slice(-4)}`,
      class_type: seed % 2 === 0 ? "Motorcycle" : "Motor Car",
    },
    {
      registration_number: `AP${String((seed % 37) + 10).padStart(2, "0")} ${districtCodeValue}${String(2000 + seed).slice(-4)}`,
      class_type: seed % 3 === 0 ? "Goods Carrier" : "Bus",
    },
  ];
}

function makeDrivers(district: string, seed: number) {
  return [
    {
      name: `${FIRST_NAMES[seed % FIRST_NAMES.length]} ${LAST_NAMES[(seed + 1) % LAST_NAMES.length]}`,
      dl_number: `AP${String((seed % 90) + 10)}2026${String(100000 + seed).slice(-6)}`,
      licensing_authority: `RTA ${district}`,
    },
    {
      name: `${FIRST_NAMES[(seed + 2) % FIRST_NAMES.length]} ${LAST_NAMES[(seed + 3) % LAST_NAMES.length]}`,
      dl_number: `AP${String((seed % 90) + 11)}2026${String(200000 + seed).slice(-6)}`,
      licensing_authority: `RTA ${district}`,
    },
  ];
}

function makeOfficerName(seed: number, role: "si" | "dsp" | "sp"): string {
  const offset = role === "si" ? 0 : role === "dsp" ? 3 : 6;
  return `${FIRST_NAMES[(seed + offset) % FIRST_NAMES.length]} ${LAST_NAMES[(seed + offset + 2) % LAST_NAMES.length]}`;
}

async function seedDistrictDemoSubmissions() {
  console.log("Seeding 5 demo submissions for each district user...");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const usersResult = await client.query<{
      user_id: string;
      district: string;
      email: string;
    }>(
      `SELECT u.id AS user_id, p.district, u.email
       FROM users u
       INNER JOIN profiles p ON p.user_id = u.id
       INNER JOIN user_roles r ON r.user_id = u.id
       WHERE r.role = 'user'
       ORDER BY p.district`
    );

    if (usersResult.rows.length === 0) {
      throw new Error("No district users found. Run the user seed first.");
    }

    let inserted = 0;

    for (const [districtIndex, row] of usersResult.rows.entries()) {
      const { user_id: userId, district } = row;
      const code = districtCode(district);
      const stations = DISTRICT_STATIONS[district];

      if (!stations || stations.length < 5) {
        throw new Error(`Missing station seed data for district: ${district}`);
      }

      await client.query(
        "DELETE FROM accident_submissions WHERE user_id = $1 AND fir_number LIKE $2",
        [userId, `DEMO/${code}/%`]
      );

      for (let itemIndex = 0; itemIndex < 5; itemIndex += 1) {
        const seed = districtIndex * 10 + itemIndex + 1;
        const accidentDate = makeDate(seed);
        const verifiedDate = makeDate(seed + 1);
        const approvedDate = makeDate(seed + 2);
        const preparedDate = accidentDate;
        const policeStation = cleanStationName(stations[itemIndex]);
        const mandal = policeStation;
        const place = `${policeStation} ${LOCATION_SUFFIXES[itemIndex]}`;
        const fir = `DEMO/${code}/2026/${String(itemIndex + 1).padStart(3, "0")}`;

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
            userId,
            district,
            place,
            mandal,
            policeStation,
            fir,
            ROAD_TYPES[seed % ROAD_TYPES.length],
            accidentDate,
            makeTime(seed),
            makeLatLong(seed),
            (seed % 3) + 1,
            (seed % 5) + 1,
            JSON.stringify(makeVehicles(code, seed)),
            JSON.stringify(makeDrivers(district, seed)),
            JSON.stringify(causes(pick(DRIVER_RELATED_CAUSES, seed, 2))),
            JSON.stringify(causes(pick(VEHICLE_CONDITION_CAUSES, seed, 1))),
            JSON.stringify(causes(pick(ROAD_NATURE_CAUSES, seed, 1))),
            JSON.stringify(causes(pick(ROAD_JUNCTIONS_CAUSES, seed, 1))),
            JSON.stringify(causes(pick(ROAD_SIGNAGES_CAUSES, seed, 1))),
            JSON.stringify(causes(pick(ROAD_MEDIAN_CAUSES, seed, 1))),
            JSON.stringify(causes(pick(ROAD_CULVERTS_CAUSES, seed, 1))),
            makeOfficerName(seed, "si"),
            `Sub-Inspector, ${district}`,
            preparedDate,
            makeOfficerName(seed, "dsp"),
            `DSP Traffic, ${district}`,
            verifiedDate,
            makeOfficerName(seed, "sp"),
            `Superintendent of Police, ${district}`,
            approvedDate,
          ]
        );

        inserted += 1;
      }

      console.log(`Seeded 5 demo submissions for ${district} (${row.email}).`);
    }

    await client.query("COMMIT");
    console.log(`Inserted ${inserted} demo submissions across ${usersResult.rows.length} districts.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("District demo seed failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDistrictDemoSubmissions();
