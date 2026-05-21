import { ZodError, type ZodIssue } from "zod";

export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export class ScrapeContextError extends Error {
  readonly context: ErrorContext;

  constructor(message: string, context: ErrorContext, cause?: unknown) {
    super(message);
    this.name = "ScrapeContextError";
    this.context = context;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function formatContext(context: ErrorContext): string {
  const entries = Object.entries(context).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `  ${k}: ${v}`).join("\n");
}

function formatZodIssue(issue: ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  const parts = [`${path}: ${issue.message}`];
  if (issue.code === "invalid_type") {
    parts.push(`expected ${issue.expected}, received ${issue.received}`);
  }
  return parts.join(" — ");
}

function formatErrorInner(err: unknown, depth: number): string[] {
  if (depth > 6) {
    return ["  (error chain truncated)"];
  }

  if (err instanceof ScrapeContextError) {
    const lines = [err.message];
    const ctx = formatContext(err.context);
    if (ctx) {
      lines.push("Context:");
      lines.push(ctx);
    }
    if (err.cause !== undefined) {
      lines.push("Caused by:");
      lines.push(...formatErrorInner(err.cause, depth + 1).map((l) => `  ${l}`));
    }
    return lines;
  }

  if (err instanceof ZodError) {
    const lines = [
      `Schema validation failed (${err.issues.length} issue${err.issues.length === 1 ? "" : "s"}):`,
    ];
    for (const issue of err.issues.slice(0, 20)) {
      lines.push(`  - ${formatZodIssue(issue)}`);
    }
    if (err.issues.length > 20) {
      lines.push(`  - … and ${err.issues.length - 20} more`);
    }
    return lines;
  }

  if (err instanceof Error) {
    const lines = [err.name !== "Error" ? `${err.name}: ${err.message}` : err.message];
    if (err.cause !== undefined && err.cause !== err) {
      lines.push("Caused by:");
      lines.push(...formatErrorInner(err.cause, depth + 1).map((l) => `  ${l}`));
    } else if (err.stack && depth === 0) {
      const stackLines = err.stack.split("\n").slice(1, 6);
      if (stackLines.length > 0) {
        lines.push("Stack (top):");
        for (const line of stackLines) {
          lines.push(`  ${line.trim()}`);
        }
      }
    }
    return lines;
  }

  try {
    return [JSON.stringify(err, null, 2)];
  } catch {
    return [String(err)];
  }
}

/** Safe for Node 24+ where console.error(ZodError) crashes util.inspect. */
export function formatError(err: unknown): string {
  return formatErrorInner(err, 0).join("\n");
}

export function logFatalError(phase: string, err: unknown): void {
  const divider = "─".repeat(60);
  console.error(`\n${divider}`);
  console.error(`[collect] FAILED — ${phase}`);
  console.error(divider);
  console.error(formatError(err));
  console.error(`${divider}\n`);
}

export async function runStep<T>(
  phase: string,
  context: ErrorContext,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new ScrapeContextError(phase, context, err);
  }
}

/** Summarize API JSON shape when validation fails (no full payload dump). */
export function summarizeFlightJson(json: unknown): ErrorContext {
  if (!json || typeof json !== "object") {
    return { responseType: typeof json };
  }
  const record = json as Record<string, unknown>;
  const results = record.Results;
  const summary: ErrorContext = {
    topLevelKeys: Object.keys(record).join(", "),
  };
  if (typeof record.LastUpdated === "string") {
    summary.lastUpdated = record.LastUpdated;
  }
  if (Array.isArray(results)) {
    summary.resultCount = results.length;
  } else {
    summary.resultsField = typeof results;
  }
  return summary;
}
