import bcrypt from "bcrypt";
import pool from "../../../src/db.js";

const SALT_ROUNDS = 12;

const DISTRICT_USERS = [
  { district: "Alluri Sitharama Raju", username: "alluri_sitharama_raju", password: "ASRj@2025" },
  { district: "Anakapalli", username: "anakapalli", password: "Ankp@2025" },
  { district: "Ananthapuram", username: "ananthapuram", password: "Antm@2025" },
  { district: "Ananthapuramu EXCISE", username: "ananthapuramu_excise", password: "AExc@2025" },
  { district: "Annamayya", username: "annamayya", password: "Anny@2025" },
  { district: "Annamayya EXCISE", username: "annamayya_excise", password: "NExc@2025" },
  { district: "Bapatla", username: "bapatla", password: "Bptl@2025" },
  { district: "Bapatla EXCISE", username: "bapatla_excise", password: "BExc@2025" },
  { district: "C I D", username: "c_i_d", password: "CID@2025x" },
  { district: "Chittoor", username: "chittoor", password: "Chtr@2025" },
  { district: "Chittoor  EXCISE", username: "chittoor_excise", password: "CExc@2025" },
  { district: "Coastal Security Police", username: "coastal_security_police", password: "CSP@2025x" },
  { district: "Dr. B R Ambedkar Konaseema", username: "dr_b_r_ambedkar_konaseema", password: "DBRK@2025" },
  { district: "Dr. B R Ambedkar Konaseema EXCISE", username: "dr_b_r_ambedkar_konaseema_excise", password: "DKEx@2025" },
  { district: "Eagle", username: "eagle", password: "Eagl@2025" },
  { district: "East Godavari", username: "east_godavari", password: "EGod@2025" },
  { district: "East Godavari EXCISE", username: "east_godavari_excise", password: "EGEx@2025" },
  { district: "Eluru", username: "eluru", password: "Elru@2025" },
  { district: "GRP Guntakal", username: "grp_guntakal", password: "GRPG@2025" },
  { district: "GRP Vijayawada", username: "grp_vijayawada", password: "GRPV@2025" },
  { district: "Guntur", username: "guntur", password: "Gntr@2025" },
  { district: "Intelligence  Unit", username: "intelligence_unit", password: "INTU@2025" },
  { district: "Kakinada", username: "kakinada", password: "Kknd@2025" },
  { district: "Krishna", username: "krishna", password: "Krsh@2025" },
  { district: "Kurnool", username: "kurnool", password: "Krnl@2025" },
  { district: "Markapuram", username: "markapuram", password: "Mrkp@2025" },
  { district: "NTR Commissionerate", username: "ntr_commissionerate", password: "NTRC@2025" },
  { district: "Nandyal", username: "nandyal", password: "Ndyl@2025" },
  { district: "Palnadu", username: "palnadu", password: "Plnd@2025" },
  { district: "Parvathipuram Manyam", username: "parvathipuram_manyam", password: "PvMy@2025" },
  { district: "Polavaram", username: "polavaram", password: "Plvr@2025" },
  { district: "Prakasam", username: "prakasam", password: "Prkm@2025" },
  { district: "Red Sanders Anti-Smuggling Task Force", username: "red_sanders_anti_smuggling_task_force", password: "RSAT@2025" },
  { district: "Sri Potti Sriramulu Nellore", username: "sri_potti_sriramulu_nellore", password: "SPSN@2025" },
  { district: "Sri Sathya Sai", username: "sri_sathya_sai", password: "SSSi@2025" },
  { district: "Srikakulam", username: "srikakulam", password: "Sklm@2025" },
  { district: "Tirupathi", username: "tirupathi", password: "Trpt@2025" },
  { district: "Visakhapatnam Commissionerate", username: "visakhapatnam_commissionerate", password: "VSPC@2025" },
  { district: "Vizianagaram", username: "vizianagaram", password: "Vzng@2025" },
  { district: "West Godavari", username: "west_godavari", password: "WGod@2025" },
  { district: "YSR Kadapa", username: "ysr_kadapa", password: "Kdpa@2025" },
  { district: "Prism", username: "prism", password: "Prsm@2025" },
] as const;

const ADMIN_USERS = [
  { username: "dgp", password: "DGP@admin2025", fullName: "Director General of Police", role: "dgp", district: "State HQ" },
  { username: "adgp", password: "ADGP@admin2025", fullName: "Additional DGP", role: "adgp", district: "State HQ" },
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
    console.log("District".padEnd(40) + "Username".padEnd(45) + "Password");
    console.log("-".repeat(110));

    // Create district users
    for (const account of DISTRICT_USERS) {
      const { district, username, password } = account;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const userResult = await client.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [username, passwordHash]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'user')",
        [userId]
      );
      if (district === "Prism") {
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, 'prism')",
          [userId]
        );
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')",
          [userId]
        );
      }

      await client.query(
        "INSERT INTO profiles (user_id, full_name, district, designation) VALUES ($1, $2, $3, $4)",
        [userId, district === "Prism" ? "PRISM Team" : `${district} DRSC Unit`, district, district === "Prism" ? "PRISM Super Admin" : "District DRSC"]
      );

      console.log(district.padEnd(40) + username.padEnd(45) + password);
    }

    console.log("\n=== ADMIN LOGINS ===\n");
    console.log("Role".padEnd(15) + "Username".padEnd(20) + "Password");
    console.log("-".repeat(55));

    // Create admin users (DGP & ADGP)
    for (const admin of ADMIN_USERS) {
      const passwordHash = await bcrypt.hash(admin.password, SALT_ROUNDS);

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

      console.log(admin.role.toUpperCase().padEnd(15) + admin.username.padEnd(20) + admin.password);
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
