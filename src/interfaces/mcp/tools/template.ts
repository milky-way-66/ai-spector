import { join } from "node:path";
import { loadDocflowConfig } from "@/core/config/load.js";
import { pathExists, readJson } from "@/core/util/fs.js";
import type { PackManifest } from "@/core/config/types.js";
import { markPackSetupItem } from "@/core/template/pack-setup.js";
import { validateCustomPack } from "@/core/template/pack-validate.js";
import { buildScanInference } from "@/core/template/scan-inference.js";
import type { ScanResult } from "@/core/template/scan.js";
import { gatherTemplateListReport } from "@/core/operations/template-list.js";
import { installTemplateFromStaging, scanTemplatesToStaging } from "@/core/operations/template.js";
import type {
  TemplateListSchema,
  TemplateInspectSchema,
  TemplateValidateSchema,
  TemplateSetupMarkSchema,
  TemplateInferSchema,
  TemplateScanSchema,
  TemplateInstallSchema,
} from "../schemas.js";
import type { z } from "zod";

async function findRoot(root?: string): Promise<string> {
  const { root: projectRoot } = await loadDocflowConfig(root);
  return projectRoot;
}

export async function toolTemplateList(input: z.infer<typeof TemplateListSchema>) {
  return gatherTemplateListReport(input.root);
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

export async function toolTemplateInfer(input: z.infer<typeof TemplateInferSchema>) {
  const projectRoot = await findRoot(input.root);
  const stagingDir = join(projectRoot, ".ai-spector", "packs", ".staging");
  const scanResultPath = join(stagingDir, "scan-result.json");
  if (!(await pathExists(scanResultPath))) {
    throw new Error(
      "scan-result.json not found in staging. Run template scan first.",
    );
  }
  const scanResult = await readJson<ScanResult>(scanResultPath);
  const { config } = await loadDocflowConfig(input.root);
  const inference = buildScanInference(scanResult, {
    languages: config.languages?.map((l) => l.code) ?? [],
  });
  const profile = {
    version: 1 as const,
    scannedAt: scanResult.scannedAt,
    sourceDir: scanResult.sourceDir,
    ...inference,
  };
  const profilePath = join(stagingDir, "clarify-profile.json");
  const { writeJson } = await import("@/core/util/fs.js");
  await writeJson(profilePath, profile);
  return {
    profilePath: profilePath.replace(projectRoot, "").replace(/^\//, ""),
    aspectCoverage: inference.aspectCoverage,
    repeatingCandidates: inference.repeatingCandidates,
    scanDigest: inference.scanDigest,
    supplementalQuestions: inference.supplementalQuestions,
  };
}

export async function toolTemplateScan(input: z.infer<typeof TemplateScanSchema>) {
  const projectRoot = await findRoot(input.root);
  const result = await scanTemplatesToStaging({
    cwd: projectRoot,
    sourcePath: input.sourcePath,
  });
  return {
    fileCount: result.fileCount,
    sourceDir: result.scanResult.sourceDir,
    scanResultPath: result.scanResultPath.replace(projectRoot, "").replace(/^\//, ""),
    files: result.scanResult.files.map((f) => ({
      relativePath: f.relativePath,
      headingCount: f.headings.length,
      placeholders: f.placeholders,
    })),
    nextTools: ["task_create", "template_infer"],
  };
}

export async function toolTemplateInstall(input: z.infer<typeof TemplateInstallSchema>) {
  const projectRoot = await findRoot(input.root);
  const result = await installTemplateFromStaging({
    cwd: projectRoot,
    name: input.name,
    dryRun: input.dryRun,
    legacy: input.legacy,
  });
  return {
    ...result,
    destDir: result.destDir.replace(projectRoot, "").replace(/^\//, ""),
    nextTools: ["template_validate", "task_update", "task_get"],
  };
}
