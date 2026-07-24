import { config } from "dotenv";
config({ path: ".env.local" });
import { getReadyPool } from "./src/lib/server/db";

async function run() {
  const pool = await getReadyPool();
  const res = await pool.query(`
    SELECT column_name, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'student_clubs' AND column_name = 'verification_document_url'
  `);
  console.log(res.rows);
  process.exit(0);
}
run();
