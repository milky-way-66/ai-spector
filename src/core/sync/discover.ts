import { discoverDocSourceFiles } from "../index/docs-build.js";
import { DESIGN_LAYERS, DESIGN_LAYER_ROOTS } from "./constants.js";
import type { BaselineFileEntry, DesignLayer } from "./types.js";

export async function discoverDesignLayerFiles(
  projectRoot: string,
): Promise<Record<DesignLayer, Record<string, BaselineFileEntry>>> {
  const out = {} as Record<DesignLayer, Record<string, BaselineFileEntry>>;
  for (const layer of DESIGN_LAYERS) {
    const root = DESIGN_LAYER_ROOTS[layer];
    const files = await discoverDocSourceFiles(projectRoot, { root, glob: "**/*.md" });
    const map: Record<string, BaselineFileEntry> = {};
    for (const f of files) {
      map[f.relativePath.replace(/\\/g, "/")] = {
        hash: f.contentHash,
        sizeBytes: f.sizeBytes,
      };
    }
    out[layer] = map;
  }
  return out;
}

export function totalsForLayers(
  layers: Record<DesignLayer, Record<string, BaselineFileEntry>>,
): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const map of Object.values(layers)) {
    for (const e of Object.values(map)) {
      files++;
      bytes += e.sizeBytes;
    }
  }
  return { files, bytes };
}
