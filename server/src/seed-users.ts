import bcrypt from "bcrypt";
import pool from "./db.js";

const SALT_ROUNDS = 12;

const AP_DISTRICTS = [
  "Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna",
  "Kurnool", "Nellore", "Prakasam", "Srikakulam", "Visakhapatnam",
  "Vizianagaram", "West Godavari", "YSR Kadapa", "Bapatla", "Eluru",
  "Kakinada", "Konaseema", "Nandyal", "NTR", "Palnadu",
  "Parvathipuram Manyam", "Sri Sathya Sai", "Tirupati", "Anakapalli",
  "Alluri Sitharama Raju"
];

// Unique passwords for each district
const DISTRICT_PASSWORDS: Record<string, string> = {
  "Anantapur": "Antp@2025",
  "Chittoor": "Chtr@2025",
  "East Godavari": "EGod@2025",
  "Guntur": "Gntr@2025",
  "Krishna": "Krsh@2025",
  "Kurnool": "Krnl@2025",
  "Nellore": "Nllr@2025",
  "Prakasam": "Prkm@2025",
  "Srikakulam": "Sklm@2025",
  "Visakhapatnam": "Vskp@2025",
  "Vizianagaram": "Vzng@2025",
  "West Godavari": "WGod@2025",
  "YSR Kadapa": "Kdpa@2025",
  "Bapatla": "Bptl@2025",
  "Eluru": "Elru@2025",
  "Kakinada": "Kknd@2025",
  "Konaseema": "Knsm@2025",
  "Nandyal": "Ndyl@2025",
  "NTR": "Ntr@2025x",
  "Palnadu": "Plnd@2025",
  "Parvathipuram Manyam": "PvMy@2025",
  "Sri Sathya Sai": "SSSi@2025",
  "Tirupati": "Trpt@2025",
  "Anakapalli": "Ankp@2025",
  "Alluri Sitharama Raju": "ASRj@2025",
};

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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Clean existing users (fresh seed)
    await client.query("DELETE FROM accident_submissions");
    await client.query("DELETE FROM user_roles");
    await client.query("DELETE FROM profiles");
    await client.query("DELETE FROM users");

    console.log("=== DISTRICT LOGINS ===\n");
    console.log("District".padEnd(30) + "Username".padEnd(35) + "Password");
    console.log("-".repeat(85));

    // Create district users
    for (const district of AP_DISTRICTS) {
      const username = district.toLowerCase().replace(/\s+/g, "_");
      const password = DISTRICT_PASSWORDS[district];
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

      await client.query(
        "INSERT INTO profiles (user_id, full_name, district, designation) VALUES ($1, $2, $3, $4)",
        [userId, `${district} DRSC Unit`, district, "District DRSC"]
      );

      console.log(district.padEnd(30) + username.padEnd(35) + password);
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
