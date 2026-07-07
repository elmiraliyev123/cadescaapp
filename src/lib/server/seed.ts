import { Pool } from "pg";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.development.local" });

async function main() {
  const pool = new Pool(); 

  try {
    const id = `user_${crypto.randomBytes(8).toString("hex")}`;
    const passwordHash = await bcrypt.hash("1234", 10);
    const email = "elmir@elmir.com";

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, student_status, student_menu_access, email_verified, verified_via) 
       VALUES ($1, $2, $3, $4, 'verified', true, true, 'email') 
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, email_verified = true, student_status = 'verified', student_menu_access = true`,
      [id, "Elmir", email, passwordHash]
    );

    console.log("Seeded demo user elmir@elmir.com");
  } catch (err) {
    console.error("Error seeding:", err instanceof Error ? err.message : "unknown");
  } finally {
    await pool.end();
  }
}

main();
