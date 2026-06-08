import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";

/** YYYY-MM-DD partition from an ISO-8601 timestamp. */
export function dateFolder(iso: string): string {
  return iso.slice(0, 10);
}

/** Filesystem-safe timestamp segment for sorted filenames. */
export function safeTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

export function resolvedJobFileName(resolvedAt: string, jobId: string): string {
  return `${safeTimestamp(resolvedAt)}_${jobId}.json`;
}

export function failedJobFileName(failedAt: string, jobId: string): string {
  return `${safeTimestamp(failedAt)}_${jobId}.json`;
}

export function historyEntryFileName(
  changedAt: string,
  sequence: number,
  lang: string,
  jobId?: string,
): string {
  const jobPart = jobId ? jobId.slice(0, 8) : "nojob";
  const seq = String(sequence).padStart(3, "0");
  return `${safeTimestamp(changedAt)}_${seq}_${lang}_${jobPart}.json`;
}

export async function listJsonFilesRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  if (!(await pathExists(dir))) {
    return results;
  }

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

/** Match full or prefix job id against archive filenames ending with `_{jobId}.json`. */
export function jobIdMatchesFileName(fileName: string, jobId: string): boolean {
  if (!fileName.endsWith(".json")) {
    return false;
  }
  const stem = fileName.slice(0, -".json".length);
  const idx = stem.lastIndexOf("_");
  if (idx < 0) {
    return false;
  }
  const idInFile = stem.slice(idx + 1);
  return idInFile === jobId || idInFile.startsWith(jobId);
}
