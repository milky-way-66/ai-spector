import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import type { PackManifest } from "../config/types.js";
import type { PackSetupState } from "../template/pack-setup.js";
import { pathExists, readJson } from "../util/fs.js";
import { getActiveTaskForSlot } from "./task.js";

export interface TemplatePackListEntry {
  name: string;
  type: "builtin" | "custom";
  activeSrs: boolean;
  activeBasicDesign: boolean;
  purpose?: string;
  description?: string;
  documentCount?: number;
  setupStatus?: PackSetupState["status"] | "unknown";
  setupBlockers?: string[];
}

export interface TemplateStagingSummary {
  hasScan: boolean;
  hasClarifyProfile: boolean;
  hasManifest: boolean;
  hasGenerateSkill: boolean;
  hasTemplates: boolean;
  sourceDir?: string;
  scannedAt?: string;
  packNameHint?: string;
}

export interface TemplateListReport {
  activeSrsPack: string;
  activeBasicDesignPack: string;
  packs: TemplatePackListEntry[];
  staging: TemplateStagingSummary | null;
  importTask: {
    taskId: string;
    currentStepId: string;
    phase: string;
    status: string;
  } | null;
  /** MCP tools to run next (agents prefer these over CLI). */
  suggestedNextTools: string[];
}

async function listInstalledPackNames(root: string): Promise<string[]> {
  const packsDir = join(root, ".ai-spector", "packs");
  if (!(await pathExists(packsDir))) return [];
  const { readdir } = await import("node:fs/promises");
  try {
    const entries = await readdir(packsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name !== ".staging")
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function readStagingSummary(root: string): Promise<TemplateStagingSummary | null> {
  const stagingDir = join(root, ".ai-spector", "packs", ".staging");
  if (!(await pathExists(stagingDir))) return null;

  const scanPath = join(stagingDir, "scan-result.json");
  const clarifyPath = join(stagingDir, "clarify-profile.json");
  const manifestPath = join(stagingDir, "manifest.json");
  const skillPath = join(stagingDir, "generate-skill.md");
  const templatesDir = join(stagingDir, "templates");

  const hasScan = await pathExists(scanPath);
  let sourceDir: string | undefined;
  let scannedAt: string | undefined;
  if (hasScan) {
    try {
      const scan = await readJson<{ sourceDir?: string; scannedAt?: string }>(scanPath);
      sourceDir = scan.sourceDir;
      scannedAt = scan.scannedAt;
    } catch {
      // ignore
    }
  }

  let packNameHint: string | undefined;
  if (await pathExists(manifestPath)) {
    try {
      const m = await readJson<PackManifest>(manifestPath);
      packNameHint = m.packName;
    } catch {
      // ignore
    }
  }

  return {
    hasScan,
    hasClarifyProfile: await pathExists(clarifyPath),
    hasManifest: await pathExists(manifestPath),
    hasGenerateSkill: await pathExists(skillPath),
    hasTemplates: await pathExists(templatesDir),
    sourceDir,
    scannedAt,
    packNameHint,
  };
}

function suggestNextTools(
  staging: TemplateStagingSummary | null,
  importTask: TemplateListReport["importTask"],
): string[] {
  if (importTask) {
    return ["task_get", "task_resume", "template_infer", "task_approve_import_plan", "template_install"];
  }
  if (!staging?.hasScan) {
    return ["template_scan", "task_create"];
  }
  if (!staging.hasClarifyProfile) {
    return ["template_infer", "task_create"];
  }
  if (staging.hasManifest && staging.hasGenerateSkill) {
    return ["task_approve_import_plan", "template_install", "template_validate"];
  }
  return ["template_infer", "task_update", "task_get"];
}

/** Shared pack list for CLI `template list` and MCP `template_list`. */
export async function gatherTemplateListReport(root?: string): Promise<TemplateListReport> {
  const { root: projectRoot, config } = await loadDocflowConfig(root);
  const srsPack = config.packs.srs;
  const bdPack = config.packs.basicDesign;
  const installed = await listInstalledPackNames(projectRoot);

  const packs: TemplatePackListEntry[] = [
    {
      name: "builtin",
      type: "builtin",
      activeSrs: srsPack === "builtin",
      activeBasicDesign: bdPack === "builtin",
      description: "Default SRS + basic-design templates",
    },
  ];

  for (const name of installed) {
    const entry: TemplatePackListEntry = {
      name,
      type: "custom",
      activeSrs: srsPack === name,
      activeBasicDesign: bdPack === name,
    };
    try {
      const packDir = join(projectRoot, ".ai-spector", "packs", name);
      const manifest = await readJson<PackManifest>(join(packDir, "manifest.json"));
      entry.description = manifest.description;
      entry.purpose = manifest.purpose;
      entry.documentCount = manifest.documents?.length;
    } catch {
      entry.setupStatus = "unknown";
    }
    try {
      const setupPath = join(projectRoot, ".ai-spector", "packs", name, "pack-setup.json");
      if (await pathExists(setupPath)) {
        const setup = await readJson<PackSetupState>(setupPath);
        entry.setupStatus = setup.status;
        entry.setupBlockers = setup.items
          .filter((i) => i.required && !i.done)
          .map((i) => i.id);
      }
    } catch {
      // ignore
    }
    packs.push(entry);
  }

  const staging = await readStagingSummary(projectRoot);
  const activeImport = await getActiveTaskForSlot(projectRoot, "import");
  const importTask = activeImport
    ? {
        taskId: activeImport.id,
        currentStepId: activeImport.currentStepId,
        phase: activeImport.phase,
        status: activeImport.status,
      }
    : null;

  return {
    activeSrsPack: srsPack,
    activeBasicDesignPack: bdPack,
    packs,
    staging,
    importTask,
    suggestedNextTools: suggestNextTools(staging, importTask),
  };
}
