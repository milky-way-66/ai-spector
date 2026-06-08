import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { loadDocflowConfig } from "../../../core/config/load.js";
import { pathExists, readJson } from "../../../core/util/fs.js";
import type { PackManifest } from "../../../core/config/types.js";
import type { TemplateListSchema, TemplateInspectSchema } from "../schemas.js";
import type { z } from "zod";

async function findRoot(root?: string): Promise<string> {
  const { root: projectRoot } = await loadDocflowConfig(root);
  return projectRoot;
}

async function listInstalledPackNames(projectRoot: string): Promise<string[]> {
  const packsDir = join(projectRoot, ".ai-spector", "packs");
  if (!(await pathExists(packsDir))) return [];
  try {
    const entries = await readdir(packsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name !== ".staging")
      .map((e) => e.name);
  } catch {
    return [];
  }
}

export async function toolTemplateList(input: z.infer<typeof TemplateListSchema>) {
  const projectRoot = await findRoot(input.root);
  const { config } = await loadDocflowConfig(input.root);
  const active = config.packs?.active;
  const installed = await listInstalledPackNames(projectRoot);

  const packs: Array<{ name: string; active: boolean; description?: string }> = [
    { name: "builtin", active: !active || active === "builtin" },
  ];

  for (const name of installed) {
    let description: string | undefined;
    try {
      const manifestPath = join(projectRoot, ".ai-spector", "packs", name, "manifest.json");
      const manifest = await readJson<PackManifest>(manifestPath);
      description = manifest.description ?? undefined;
    } catch {
      // ignore missing manifest
    }
    packs.push({ name, active: active === name, description });
  }

  return { packs, activePack: active ?? "builtin" };
}

export async function toolTemplateInspect(input: z.infer<typeof TemplateInspectSchema>) {
  const projectRoot = await findRoot(input.root);
  if (input.pack === "builtin") {
    return { name: "builtin", type: "builtin" };
  }
  const manifestPath = join(projectRoot, ".ai-spector", "packs", input.pack, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Pack "${input.pack}" is not installed.`);
  }
  const manifest = await readJson<PackManifest>(manifestPath);
  return { name: input.pack, type: "custom", manifest };
}
