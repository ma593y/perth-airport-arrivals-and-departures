import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type RunContext = {
  runId: string;
};

const storage = new AsyncLocalStorage<RunContext>();

export function getRunId(): string | undefined {
  return storage.getStore()?.runId;
}

export async function runWithId<T>(fn: () => Promise<T>): Promise<T> {
  const runId = randomUUID();
  return storage.run({ runId }, fn);
}
