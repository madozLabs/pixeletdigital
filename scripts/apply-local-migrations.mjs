import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const databaseUrl = new URL(connectionString);
if (!new Set(["127.0.0.1", "localhost"]).has(databaseUrl.hostname)) {
  throw new Error("Refusing to apply raw migrations outside a local database.");
}

const migrationsDirectory = path.resolve("prisma", "migrations");
const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const migrationFiles = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(migrationsDirectory, entry.name, "migration.sql"))
  .sort();
const client = new pg.Client({ connectionString });

await client.connect();
try {
  for (const migrationFile of migrationFiles) {
    await client.query(await readFile(migrationFile, "utf8"));
    console.log(`Applied ${path.basename(path.dirname(migrationFile))}`);
  }
} finally {
  await client.end();
}
