import { neon } from "@neondatabase/serverless";

// The placeholder lets the app build without a database. Queries need a real DATABASE_URL.
export const sql = neon(process.env.DATABASE_URL ?? "postgresql://user:pass@localhost/db");
