import path from "node:path";
import { projectRoot } from "./paths.js";

/** Format an absolute path relative to the repository root (forward slashes). */
export function formatRepoRelativePath(absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}
