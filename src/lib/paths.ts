import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (parent of `src/`). */
export const projectRoot = path.dirname(path.dirname(srcDir));

export const dataDir = path.join(projectRoot, "data");

export const publicDir = path.join(projectRoot, "public");

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.join(dataDir, "flights.db");
}

/** Format an absolute path relative to the repository root (forward slashes). */
export function formatRepoRelativePath(absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}
