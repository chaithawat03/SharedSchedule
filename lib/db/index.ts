import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database operations");
  }

  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

let sharedDatabase: ReturnType<typeof createDatabase> | undefined;

export function getDatabase() {
  sharedDatabase ??= createDatabase();
  return sharedDatabase;
}
