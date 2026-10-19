import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000
});
pool.on("error", err => console.error("Unexpected PostgreSQL error:", err.message));
