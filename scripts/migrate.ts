import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSqlite } from "../src/db/client.js";

const drizzleDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "drizzle",
);

export function runMigrations(): void {
  const sqlite = getSqlite();
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at INTEGER NOT NULL)",
  );

  const applied = new Set(
    (
      sqlite
        .prepare("SELECT hash FROM __drizzle_migrations")
        .all() as { hash: string }[]
    ).map((r) => r.hash),
  );

  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const hash = file.replace(/\.sql$/, "");
    if (applied.has(hash)) continue;

    const sql = readFileSync(path.join(drizzleDir, file), "utf8");
    const statements = sql
      .split(/--> statement-breakpoint\n?/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      sqlite.exec(statement);
    }

    sqlite
      .prepare(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      )
      .run(hash, Date.now());

    console.log(`Applied migration: ${file}`);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runMigrations();
  console.log("Migrations complete.");
}
