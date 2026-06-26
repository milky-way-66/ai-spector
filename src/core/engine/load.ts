import { join } from "node:path";
import { readJson, writeJson, pathExists } from "../util/fs.js";
import { ENGINE_CONFIG_REL, DEFAULT_ENGINE_ARTIFACTS } from "./paths.js";
import type { EngineConfig } from "./types.js";

export function defaultEngineConfig(): EngineConfig {
  return {
    schemaVersion: 1,
    artifacts: { ...DEFAULT_ENGINE_ARTIFACTS },
    cocoindex: { enabled: false },
    readiness: { profile: "general", standards: [], docTypes: {}, lastScan: null },
  };
}

function mergeEngine(raw: Partial<EngineConfig> | null | undefined): EngineConfig {
  const base = defaultEngineConfig();
  const source = raw ?? {};
  return {
    schemaVersion: 1,
    scaffoldVersion: source.scaffoldVersion?.trim() || base.scaffoldVersion,
    artifacts: { ...base.artifacts, ...(source.artifacts ?? {}) },
    cocoindex: { ...base.cocoindex, ...(source.cocoindex ?? {}) },
    readiness: {
      ...base.readiness,
      ...(source.readiness ?? {}),
      docTypes: { ...base.readiness.docTypes, ...(source.readiness?.docTypes ?? {}) },
    },
  };
}

export async function loadEngineConfig(root: string): Promise<EngineConfig> {
  const abs = join(root, ENGINE_CONFIG_REL);
  if (!(await pathExists(abs))) {
    return defaultEngineConfig();
  }
  const raw = await readJson<Partial<EngineConfig>>(abs);
  return mergeEngine(raw);
}

export async function writeEngineConfig(root: string, config: EngineConfig): Promise<void> {
  await writeJson(join(root, ENGINE_CONFIG_REL), config);
}
