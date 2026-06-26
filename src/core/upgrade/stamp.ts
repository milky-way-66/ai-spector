import { join } from "node:path";
import { pathExists, readJson } from "../util/fs.js";
import { loadEngineConfig, writeEngineConfig } from "../engine/load.js";

/** Read scaffoldVersion from engine.json, falling back to legacy docflow.config.json. */
export async function readScaffoldVersion(root: string): Promise<string> {
  const enginePath = join(root, ".ai-spector", "engine.json");
  if (await pathExists(enginePath)) {
    const config = await loadEngineConfig(root);
    return config.scaffoldVersion ?? "0.0.0";
  }
  // Legacy fallback: read from docflow.config.json
  const legacyPath = join(root, ".ai-spector", "docflow.config.json");
  if (await pathExists(legacyPath)) {
    const raw = await readJson<{ scaffoldVersion?: string }>(legacyPath);
    return raw.scaffoldVersion ?? "0.0.0";
  }
  return "0.0.0";
}

/** Stamp scaffoldVersion into engine.json. */
export async function stampScaffoldVersion(root: string, version: string): Promise<void> {
  const config = await loadEngineConfig(root);
  await writeEngineConfig(root, { ...config, scaffoldVersion: version });
}
