import { config } from "dotenv";
config({ path: ".env.local" });
import { getReadyPool } from "./src/lib/server/db";

async function run() {
  const pool = await getReadyPool();
  try {
    const res = await pool.query(`SELECT pg_advisory_xact_lock(hashtextextended('test', 0))`);
    console.log("Success:", res.rows);
  } catch(e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
