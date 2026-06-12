import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { loadDocflowConfig } from "@/core/config/load.js";
import { pathExists, readJson } from "@/core/util/fs.js";
import type { PackManifest } from "@/core/config/types.js";
import { markPackSetupItem } from "@/core/template/pack-setup.js";
import { validateCustomPack } from "@/core/template/pack-validate.js";
import type {
  TemplateListSchema,
  TemplateInspectSchema,
  TemplateValidateSchema,
  TemplateSetupMarkSchema,
} from "../schemas.js";
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
  const srsPack = config.packs.srs;
  const bdPack = config.packs.basicDesign;
  const installed = await listInstalledPackNames(projectRoot);

  const packs: Array<{ name: string; activeSrs: boolean; activeBasicDesign: boolean; description?: string }> = [
    { name: "builtin", activeSrs: srsPack === "builtin", activeBasicDesign: bdPack === "builtin" },
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
    packs.push({ name, activeSrs: srsPack === name, activeBasicDesign: bdPack === name, description });
  }

  return { packs, activeSrsPack: srsPack, activeBasicDesignPack: bdPack };
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
  const validation = await validateCustomPack({ root: projectRoot, packName: input.pack });
  return { name: input.pack, type: "custom", manifest, validation };
}

export async function toolTemplateValidate(input: z.infer<typeof TemplateValidateSchema>) {
  const projectRoot = await findRoot(input.root);
  const { config } = await loadDocflowConfig(input.root);
  const packName = input.pack ?? "active";
  const resolved = packName === "active" ? config.packs.srs : packName;
  if (resolved === "builtin") {
    return { packName: "builtin", ready: true, gaps: [], questionsForUser: [] };
  }
  return validateCustomPack({
    root: projectRoot,
    packName: resolved,
    syncSetup: Boolean(input.sync),
  });
}

export async function toolTemplateSetupMark(input: z.infer<typeof TemplateSetupMarkSchema>) {
  const projectRoot = await findRoot(input.root);
  return markPackSetupItem(projectRoot, input.pack, input.itemId);
}
