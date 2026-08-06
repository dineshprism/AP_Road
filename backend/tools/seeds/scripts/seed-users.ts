import bcrypt from "bcrypt";
import pool from "../../../src/db.js";

const SALT_ROUNDS = 12;
const seedPassword = process.env.SEED_DEFAULT_PASSWORD;

if (!seedPassword || seedPassword.length < 12) {
  throw new Error("Set SEED_DEFAULT_PASSWORD to a strong temporary password before running this seed script.");
}

const DISTRICT_USERS = [
  { district: "Alluri Sitharama Raju", username: "alluri_sitharama_raju" },
  { district: "Anakapalli", username: "anakapalli" },
  { district: "Ananthapuram", username: "ananthapuram" },
  { district: "Ananthapuramu EXCISE", username: "ananthapuramu_excise" },
  { district: "Annamayya", username: "annamayya" },
  { district: "Annamayya EXCISE", username: "annamayya_excise" },
  { district: "Bapatla", username: "bapatla" },
  { district: "Bapatla EXCISE", username: "bapatla_excise" },
  { district: "C I D", username: "c_i_d" },
  { district: "Chittoor", username: "chittoor" },
  { district: "Chittoor  EXCISE", username: "chittoor_excise" },
  { district: "Coastal Security Police", username: "coastal_security_police" },
  { district: "Dr. B R Ambedkar Konaseema", username: "dr_b_r_ambedkar_konaseema" },
  { district: "Dr. B R Ambedkar Konaseema EXCISE", username: "dr_b_r_ambedkar_konaseema_excise" },
  { district: "Eagle", username: "eagle" },
  { district: "East Godavari", username: "east_godavari" },
  { district: "East Godavari EXCISE", username: "east_godavari_excise" },
  { district: "Eluru", username: "eluru" },
  { district: "GRP Guntakal", username: "grp_guntakal" },
  { district: "GRP Vijayawada", username: "grp_vijayawada" },
  { district: "Guntur", username: "guntur" },
  { district: "Intelligence  Unit", username: "intelligence_unit" },
  { district: "Kakinada", username: "kakinada" },
  { district: "Krishna", username: "krishna" },
  { district: "Kurnool", username: "kurnool" },
  { district: "Markapuram", username: "markapuram" },
  { district: "NTR Commissionerate", username: "ntr_commissionerate" },
  { district: "Nandyal", username: "nandyal" },
  { district: "Palnadu", username: "palnadu" },
  { district: "Parvathipuram Manyam", username: "parvathipuram_manyam" },
  { district: "Polavaram", username: "polavaram" },
  { district: "Prakasam", username: "prakasam" },
  { district: "Red Sanders Anti-Smuggling Task Force", username: "red_sanders_anti_smuggling_task_force" },
  { district: "Sri Potti Sriramulu Nellore", username: "sri_potti_sriramulu_nellore" },
  { district: "Sri Sathya Sai", username: "sri_sathya_sai" },
  { district: "Srikakulam", username: "srikakulam" },
  { district: "Tirupathi", username: "tirupathi" },
  { district: "Visakhapatnam Commissionerate", username: "visakhapatnam_commissionerate" },
  { district: "Vizianagaram", username: "vizianagaram" },
  { district: "West Godavari", username: "west_godavari" },
  { district: "YSR Kadapa", username: "ysr_kadapa" },
  { district: "Prism", username: "prism" },
] as const;

const ADMIN_USERS = [
  { username: "dgp", fullName: "Director General of Police", role: "dgp", district: "State HQ" },
  { username: "adgp", fullName: "Additional DGP", role: "adgp", district: "State HQ" },
];

async function seedUsers() {
  console.log("Seeding users...\n");

  // First, add new enum values if they don't exist
  try {
    await pool.query("ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'dgp'");
  } catch { /* already exists */ }
  try {
    await pool.query("ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'adgp'");
  } catch { /* already exists */ }
  try {
    await pool.query("ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'prism'");
  } catch { /* already exists */ }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Clean existing users (fresh seed)
    await client.query("DELETE FROM accident_submissions");
    await client.query("DELETE FROM user_roles");
    await client.query("DELETE FROM profiles");
    await client.query("DELETE FROM users");

    console.log("=== DISTRICT LOGINS ===\n");
    console.log("District".padEnd(40) + "Username".padEnd(45));
    console.log("-".repeat(85));

    // Create district users
    for (const account of DISTRICT_USERS) {
      const { district, username } = account;
      const passwordHash = await bcrypt.hash(seedPassword, SALT_ROUNDS);

      const userResult = await client.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [username, passwordHash]
      );
      const userId = userResult.rows[0].id;

      if (district === "Prism") {
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, 'prism')",
          [userId]
        );
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')",
          [userId]
        );
      } else {
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, 'user')",
          [userId]
        );
      }

      await client.query(
        "INSERT INTO profiles (user_id, full_name, district, designation) VALUES ($1, $2, $3, $4)",
        [userId, district === "Prism" ? "PRISM Team" : `${district} DRSC Unit`, district, district === "Prism" ? "PRISM Super Admin" : "District DRSC"]
      );

      console.log(district.padEnd(40) + username.padEnd(45));
    }

    console.log("\n=== ADMIN LOGINS ===\n");
    console.log("Role".padEnd(15) + "Username".padEnd(20));
    console.log("-".repeat(35));

    // Create admin users (DGP & ADGP)
    for (const admin of ADMIN_USERS) {
      const passwordHash = await bcrypt.hash(seedPassword, SALT_ROUNDS);

      const userResult = await client.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [admin.username, passwordHash]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
        [userId, admin.role]
      );

      // Also give admin role so they can access admin endpoints
      if (admin.role === "dgp") {
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')",
          [userId]
        );
      }

      await client.query(
        "INSERT INTO profiles (user_id, full_name, district, designation) VALUES ($1, $2, $3, $4)",
        [userId, admin.fullName, admin.district, admin.role.toUpperCase()]
      );

      console.log(admin.role.toUpperCase().padEnd(15) + admin.username.padEnd(20));
    }

    await client.query("COMMIT");
    console.log("\n✓ All users seeded successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers();
