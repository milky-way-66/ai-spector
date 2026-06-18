import { join } from "node:path";
import { pathExists, readJson, writeJson } from "../util/fs.js";

export async function readScaffoldVersion(root: string): Promise<string> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  if (!(await pathExists(configPath))) {
    return "0.0.0";
  }
  const raw = await readJson<{ scaffoldVersion?: string }>(configPath);
  return raw.scaffoldVersion ?? "0.0.0";
}

export async function stampScaffoldVersion(root: string, version: string): Promise<void> {
  const configPath = join(root, ".ai-spector", "docflow.config.json");
  const raw = await readJson<Record<string, unknown>>(configPath);
  await writeJson(configPath, { ...raw, scaffoldVersion: version });
}
