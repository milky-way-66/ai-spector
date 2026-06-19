import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { baselinePath } from "./constants.js";
import { pathExists, writeJson, readJson } from "../util/fs.js";
import type { SyncBaseline } from "./types.js";

export { baselinePath };

export async function loadBaseline(root: string): Promise<SyncBaseline | null> {
  const path = baselinePath(root);
  if (!(await pathExists(path))) return null;
  const raw = await readJson<SyncBaseline>(path);
  if (raw?.version !== 1) return null;
  return raw;
}

export async function saveBaseline(root: string, baseline: SyncBaseline): Promise<void> {
  await writeJson(baselinePath(root), baseline);
}

export async function hashGraphFile(absGraphPath: string): Promise<string> {
  const bytes = await readFile(absGraphPath);
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}
