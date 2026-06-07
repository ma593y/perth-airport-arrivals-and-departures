import { getRunId } from "./run-context.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  if (
    process.env.npm_lifecycle_event === "test" ||
    process.env.NODE_ENV === "test"
  ) {
    return "error";
  }
  return "info";
}

let configuredLevel: LogLevel | null = null;

function minLevel(): LogLevel {
  if (configuredLevel === null) {
    configuredLevel = resolveLogLevel();
  }
  return configuredLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel()];
}

function write(level: LogLevel, line: string): void {
  if (level === "warn" || level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export function log(
  level: LogLevel,
  component: string,
  event: string,
  fields: LogFields = {},
): void {
  if (!shouldLog(level)) return;

  const runId = getRunId();
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    component,
    event,
    ...fields,
  };
  if (runId) {
    entry.runId = runId;
  }

  write(level, JSON.stringify(entry));
}

export const logger = {
  debug: (component: string, event: string, fields?: LogFields) =>
    log("debug", component, event, fields),
  info: (component: string, event: string, fields?: LogFields) =>
    log("info", component, event, fields),
  warn: (component: string, event: string, fields?: LogFields) =>
    log("warn", component, event, fields),
  error: (component: string, event: string, fields?: LogFields) =>
    log("error", component, event, fields),
};
