import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";

export interface ReviewTrackConfig {
  minApprovals: number;
}

export interface ReviewQueueConfig {
  version: 1;
  internal: ReviewTrackConfig;
  client: ReviewTrackConfig;
  /** When false, skip writing snapshot files and purge on resolve (v2 drift model). */
  writeLegacySnapshots?: boolean;
}

const DEFAULT_CONFIG: ReviewQueueConfig = {
  version: 1,
  internal: { minApprovals: 1 },
  client: { minApprovals: 1 },
  writeLegacySnapshots: true,
};

function configPath(projectRoot: string): string {
  return join(projectRoot, ".ai-spector/.docflow/config/review-queue.json");
}

function parseMinApprovals(value: unknown, track: string, fallback: number): number {
  if (value == null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(
      `Invalid review-queue.json: ${track}.minApprovals must be an integer >= 1`,
    );
  }
  return value;
}

export function normalizeReviewQueueConfig(raw: unknown): ReviewQueueConfig {
  if (raw == null || typeof raw !== "object") {
    return { ...DEFAULT_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  const internal = (obj.internal ?? {}) as Record<string, unknown>;
  const client = (obj.client ?? {}) as Record<string, unknown>;
  const writeLegacySnapshots =
    obj.writeLegacySnapshots === undefined
      ? DEFAULT_CONFIG.writeLegacySnapshots
      : Boolean(obj.writeLegacySnapshots);

  return {
    version: 1,
    internal: {
      minApprovals: parseMinApprovals(
        internal.minApprovals,
        "internal",
        DEFAULT_CONFIG.internal.minApprovals,
      ),
    },
    client: {
      minApprovals: parseMinApprovals(
        client.minApprovals,
        "client",
        DEFAULT_CONFIG.client.minApprovals,
      ),
    },
    writeLegacySnapshots,
  };
}

export async function loadReviewQueueConfig(projectRoot: string): Promise<ReviewQueueConfig> {
  const path = configPath(projectRoot);
  if (!(await pathExists(path))) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  return normalizeReviewQueueConfig(raw);
}
