import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  loadBasicDesignListManifest,
  loadDocflowConfig,
  loadDocumentsManifest,
} from "../config/load.js";
import type { ManifestDocument } from "../config/types.js";
import {
  hasLocaleSegment,
  suggestLocalizedPath,
} from "../paths/localized-output.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { scoreBuiltinMatch, type AdoptClassifyFile } from "./classify.js";
import { adoptArtifactPaths } from "./paths.js";
import { loadAdoptContext, markAdoptSetupItem } from "./setup.js";
import type {
  AdoptInventoryItem,
  AdoptMove,
  AdoptMoveConfidence,
  AdoptPlan,
  AdoptScanResult,
} from "./types.js";

const PER_DOMAIN_PATH =
  /(?:^|\/)(?:0?[34]-(?:use-cases|system-features)|use-cases|features|system-features)(?:\/|$)/i;
const CONFIG_RELATIVE = ".ai-spector/docflow.config.json";

function scoreToConfidence(score: number): AdoptMoveConfidence {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function resolvePrimaryLang(
  context: Record<string, string>,
  languages: Array<{ code: string }>,
): string {
  return context["lang-primary"] ?? languages[0]?.code ?? "en";
}

function isPerDomainPath(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, "/");
  const name = basename(norm).toLowerCase();
  if (/^uc-/.test(name) || /^f-/.test(name)) return true;
  return PER_DOMAIN_PATH.test(norm);
}

function inventoryToClassifyFile(item: AdoptInventoryItem): AdoptClassifyFile {
  const prefix =
    item.layer === "srs" ? /^docs\/srs\// : /^docs\/basic-design\//;
  return {
    relativePath: item.path.replace(prefix, ""),
    headings: item.signals.headings,
    ids: item.signals.ids,
  };
}

function resolveTargetPath(fromPath: string, primaryLang: string): string {
  const norm = fromPath.replace(/\\/g, "/");
  if (hasLocaleSegment(norm)) {
    return norm;
  }
  return suggestLocalizedPath(norm, primaryLang);
}

function perDomainDocumentId(
  fromPath: string,
  layer: "srs" | "basic-design",
  docs: ManifestDocument[],
): string | undefined {
  const name = basename(fromPath).toLowerCase();
  if (name.startsWith("uc-")) {
    return docs.find((doc) => doc.perDomain === "useCase")?.documentId;
  }
  if (name.startsWith("f-")) {
    return docs.find((doc) => doc.perDomain === "feature")?.documentId;
  }
  if (PER_DOMAIN_PATH.test(fromPath.replace(/\\/g, "/"))) {
    if (name.includes("uc") || fromPath.includes("use-cases")) {
      return docs.find((doc) => doc.perDomain === "useCase")?.documentId;
    }
    return docs.find((doc) => doc.perDomain === "feature")?.documentId;
  }
  return undefined;
}

async function loadManifestDocuments(layer: "srs" | "basic-design") {
  if (layer === "srs") {
    const { manifest } = await loadDocumentsManifest();
    return manifest.documents;
  }
  const manifest = await loadBasicDesignListManifest();
  return manifest.documents;
}

function matchReason(confidence: AdoptMoveConfidence, documentId?: string): string {
  if (documentId && confidence === "high") return "filename + heading match";
  if (confidence === "high") return "canonical language folder mapping";
  if (confidence === "medium") return "partial filename or heading match";
  return "heuristic path mapping";
}

function collectBlockingIssues(
  scan: AdoptScanResult,
  context: Record<string, string>,
): string[] {
  const issues: string[] = [];
  for (const question of scan.questionsForUser) {
    if (question.blocking && !context[question.id]) {
      issues.push(`Unresolved: ${question.prompt}`);
    }
  }
  return issues;
}

function buildConfigPatches(
  configLanguages: Array<{ code: string; label: string }>,
  primaryLang: string,
): AdoptPlan["configPatches"] {
  if (configLanguages.some((lang) => lang.code === primaryLang)) {
    return [];
  }
  return [
    {
      path: CONFIG_RELATIVE,
      set: {
        languages: [
          ...configLanguages,
          { code: primaryLang, label: primaryLang },
        ],
      },
    },
  ];
}

async function buildPrototypeActions(
  root: string,
  scan: AdoptScanResult,
): Promise<AdoptPlan["prototypeActions"]> {
  if (scan.classification.prototype === "missing") {
    return [];
  }
  const docsPrototype = join(root, "docs/prototype");
  if (!(await pathExists(docsPrototype))) {
    return [];
  }
  return [{ action: "relocate", from: "docs/prototype/", to: "prototype/" }];
}

async function buildMoves(
  scan: AdoptScanResult,
  primaryLang: string,
): Promise<{ moves: AdoptMove[]; warnings: string[] }> {
  const moves: AdoptMove[] = [];
  const warnings: string[] = [];

  for (const item of scan.inventory) {
    if (item.layer !== "srs" && item.layer !== "basic-design") {
      continue;
    }

    const from = item.path.replace(/\\/g, "/");
    const to = resolveTargetPath(from, primaryLang);
    if (from === to) {
      continue;
    }

    const classifyFile = inventoryToClassifyFile(item);
    const score = scoreBuiltinMatch(classifyFile, item.layer);
    const confidence = scoreToConfidence(score);
    const docs = await loadManifestDocuments(item.layer);
    let documentId: string | undefined;

    if (isPerDomainPath(from)) {
      documentId = perDomainDocumentId(from, item.layer, docs);
    } else if (score >= 0.8) {
      documentId = docs.find((doc) => {
        if (doc.perDomain) return false;
        return basename(from).toLowerCase() === basename(doc.template).toLowerCase();
      })?.documentId;
    }

    if (confidence === "medium") {
      warnings.push(`Medium confidence move for ${from} → ${to}`);
    } else if (confidence === "low") {
      warnings.push(`Low confidence move for ${from} → ${to}`);
    }

    moves.push({
      from,
      to,
      layer: item.layer,
      ...(documentId ? { documentId } : {}),
      confidence,
      reason: matchReason(confidence, documentId),
    });
  }

  return { moves, warnings };
}

function emptyPlan(): AdoptPlan {
  return {
    version: 1,
    status: "draft",
    approvedAt: null,
    approvedBy: null,
    moves: [],
    configPatches: [],
    prototypeActions: [],
    warnings: [],
    blockingIssues: [],
  };
}

export async function runAdoptPlan(
  opts: { root?: string; sync?: boolean } = {},
): Promise<AdoptPlan> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const paths = adoptArtifactPaths(root);
  await mkdir(paths.dir, { recursive: true });

  if (!(await pathExists(paths.scanResult))) {
    throw new Error("No scan result — run: npx ai-spector adopt scan");
  }

  const scan = await readJson<AdoptScanResult>(paths.scanResult);
  const context = await loadAdoptContext(root);
  const primaryLang = resolvePrimaryLang(context, config.languages);

  let plan = emptyPlan();
  if (!opts.sync && (await pathExists(paths.plan))) {
    plan = await readJson<AdoptPlan>(paths.plan);
    if (plan.status !== "draft") {
      throw new Error(`Plan is already ${plan.status} — cannot regenerate`);
    }
  }

  const { moves, warnings } = await buildMoves(scan, primaryLang);
  const blockingIssues = collectBlockingIssues(scan, context);
  const configPatches = buildConfigPatches(config.languages, primaryLang);
  const prototypeActions = await buildPrototypeActions(root, scan);

  const nextPlan: AdoptPlan = {
    ...plan,
    version: 1,
    status: "draft",
    approvedAt: null,
    approvedBy: null,
    moves,
    configPatches,
    prototypeActions,
    warnings,
    blockingIssues,
  };

  await writeJson(paths.plan, nextPlan);
  return nextPlan;
}

export async function approveAdoptPlan(
  opts: { root?: string; by?: string } = {},
): Promise<AdoptPlan> {
  const { root } = await loadDocflowConfig(opts.root);
  const paths = adoptArtifactPaths(root);

  if (!(await pathExists(paths.plan))) {
    throw new Error("No adopt plan — run: npx ai-spector adopt plan");
  }

  const plan = await readJson<AdoptPlan>(paths.plan);
  if (plan.status !== "draft") {
    throw new Error(`Plan is already ${plan.status} — cannot approve`);
  }
  if (plan.blockingIssues.length > 0) {
    throw new Error(
      `Plan has ${plan.blockingIssues.length} blocking issue(s) — resolve before approving`,
    );
  }

  const approved: AdoptPlan = {
    ...plan,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy: opts.by ?? "user",
  };

  await writeJson(paths.plan, approved);
  await markAdoptSetupItem(root, "plan.approved");
  return approved;
}
