import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadDocflowConfig, primaryLanguage, resolveActivePackManifest } from "../config/load.js";
import { discoverMarkdownFiles } from "../index/docs-build.js";
import type { PackManifest } from "../config/types.js";
import { pathExists, readJson } from "../util/fs.js";
import { resolveProfileForDocType, persistReadinessLastScan } from "./config.js";
import { loadMergedReadinessCriteria } from "./resolve.js";

export type DocScanSeverity = "error" | "warning" | "suggestion";

export interface DocScanFinding {
  id: string;
  severity: DocScanSeverity;
  path: string;
  message: string;
  suggestion: string;
  rule?: string;
  criterionId?: string;
  profile?: string;
}

export interface ReadinessScanResult {
  docType: string;
  profile: string;
  profileSource: string;
  scannedAt: string;
  documentsScanned: number;
  ok: boolean;
  errorCount: number;
  warningCount: number;
  suggestionCount: number;
  findings: DocScanFinding[];
  suggestionsForUser: string[];
  configUpdated: boolean;
}

interface CompletenessRulesFile {
  defaultChecks?: {
    disallowPlaceholders?: string[];
    requireNonEmptyTables?: boolean;
  };
  rules?: Array<{
    target: string;
    documentId?: string;
    requiredHeadings?: string[];
  }>;
}

const PROFILE_DOC_HINTS: Record<string, Array<{ pattern: RegExp; criterionId: string; message: string; suggestion: string }>> = {
  regulated: [
    {
      pattern: /\b(verification method|test|analysis|inspection|demonstration)\b/i,
      criterionId: "REG-002",
      message: "Regulated profile expects verification methods documented",
      suggestion: "Add verification approach per requirement (§9 or per FR) — test / analysis / inspection / demonstration",
    },
    {
      pattern: /\b(safety class|software class|DAL|SIL|IEC 62304|ISO 14971|risk)\b/i,
      criterionId: "REG-001",
      message: "Regulated profile expects safety/risk classification",
      suggestion: "Document safety class, applicable regulations, and risk process references in §1 or §9",
    },
    {
      pattern: /\b(traceabilit|traces to|satisfies|verifies)\b/i,
      criterionId: "REG-003",
      message: "Regulated profile expects traceability language",
      suggestion: "Add requirement IDs with links to risks/tests (UC-xx, FR-xx, hazard IDs)",
    },
  ],
  arc42: [
    {
      pattern: /\b(context|scope|stakeholder)\b/i,
      criterionId: "A42-G-001",
      message: "arc42 expects context & scope",
      suggestion: "Ensure §3 Introduction and Context section describes boundaries and stakeholders",
    },
    {
      pattern: /\b(constraint|decision|ADR|architecture decision)\b/i,
      criterionId: "A42-G-007",
      message: "arc42 expects constraints and decisions",
      suggestion: "Document key ADRs and technical constraints",
    },
  ],
};

async function listMarkdownUnder(root: string, dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) return [];
  const rel = dir.replace(root + "/", "").replace(/^\.\//, "");
  const files = await discoverMarkdownFiles(root, rel);
  return files.map((f) => f.absolutePath);
}

async function resolveDocPaths(
  root: string,
  docType: string,
  config: Awaited<ReturnType<typeof loadDocflowConfig>>["config"],
  manifest: PackManifest | null,
  explicitPaths?: string[],
): Promise<string[]> {
  if (explicitPaths?.length) {
    return explicitPaths.map((p) => (p.startsWith("/") ? p : join(root, p)));
  }

  const lang = primaryLanguage(config).code;
  if (docType === "srs") {
    return listMarkdownUnder(root, join(root, "docs", "srs", lang));
  }
  if (docType === "basic-design") {
    return listMarkdownUnder(root, join(root, "docs", "basic-design", lang));
  }

  if (manifest) {
    const paths: string[] = [];
    for (const doc of manifest.documents) {
      const out = doc.output ?? doc.outputPattern ?? "";
      if (!out || out.includes("{")) {
        const packDir = join(root, ".ai-spector/packs", manifest.packName);
        const templatesDir = join(packDir, manifest.templatesDir ?? "templates");
        paths.push(...(await listMarkdownUnder(root, templatesDir)));
        continue;
      }
      paths.push(join(root, out.replace("{lang}", lang)));
    }
    return [...new Set(paths)];
  }

  return listMarkdownUnder(root, join(root, "docs"));
}

function matchRuleForFile(filePath: string, rules: CompletenessRulesFile["rules"]): {
  target: string;
  requiredHeadings?: string[];
} | null {
  const name = basename(filePath);
  for (const rule of rules ?? []) {
    if (name === rule.target || name.endsWith(`/${rule.target}`)) return rule;
  }
  return null;
}

function findMissingHeadings(content: string, required: string[]): string[] {
  return required.filter((h) => !content.includes(h));
}

function findDisallowedPlaceholders(content: string, patterns: string[]): string[] {
  const hits: string[] = [];
  for (const p of patterns) {
    if (p === "{" && content.includes("{") && /\{[a-zA-Z]/.test(content)) hits.push("{placeholder}");
    else if (p !== "{" && content.includes(p)) hits.push(p);
  }
  return [...new Set(hits)];
}

function findEmptySections(content: string): string[] {
  const lines = content.split("\n");
  const empty: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!/^#{2,4}\s/.test(line)) continue;
    const next = lines.slice(i + 1).find((l) => l.trim().length > 0);
    const nextHeading = lines.slice(i + 1).find((l) => /^#{1,4}\s/.test(l));
    if (!next || (nextHeading && lines.indexOf(nextHeading) === i + 1)) {
      empty.push(line.trim());
    }
  }
  return empty;
}

function scanProfileGaps(
  relPath: string,
  content: string,
  profile: string,
): DocScanFinding[] {
  const hints = PROFILE_DOC_HINTS[profile];
  if (!hints) return [];
  const findings: DocScanFinding[] = [];
  for (const hint of hints) {
    if (!hint.pattern.test(content)) {
      findings.push({
        id: `PROFILE-${hint.criterionId}`,
        severity: "suggestion",
        path: relPath,
        message: hint.message,
        suggestion: hint.suggestion,
        criterionId: hint.criterionId,
        profile,
      });
    }
  }
  return findings;
}

async function loadCompletenessRules(
  root: string,
  docType: string,
  packName: string | null,
): Promise<CompletenessRulesFile | null> {
  const configDir = join(root, ".ai-spector/.docflow/config");
  const candidates = [
    packName ? join(configDir, `completeness-rules.${packName}.json`) : null,
    packName ? join(root, ".ai-spector/packs", packName, "completeness-rules.json") : null,
    join(configDir, `completeness-rules.${docType}.json`),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (await pathExists(p)) return readJson<CompletenessRulesFile>(p);
  }
  return null;
}

export interface ReadinessScanOptions {
  root?: string;
  docType?: string;
  profile?: string;
  paths?: string[];
  /** Write readiness.lastScan to docflow.config.json */
  updateLastScan?: boolean;
}

export async function scanDocumentsForReadiness(
  opts: ReadinessScanOptions,
): Promise<ReadinessScanResult> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const manifest = await resolveActivePackManifest(root, config);
  const docType = opts.docType ?? "srs";
  const { profile, profileSource } = resolveProfileForDocType(config, manifest, docType);
  const effectiveProfile = opts.profile ?? profile;

  const merged = await loadMergedReadinessCriteria({
    root,
    docType,
    profile: effectiveProfile,
  });

  const completeness = await loadCompletenessRules(root, docType, merged.packName);
  const docPaths = await resolveDocPaths(root, docType, config, manifest, opts.paths);
  const findings: DocScanFinding[] = [];
  const disallow = completeness?.defaultChecks?.disallowPlaceholders ?? ["TODO", "TBD", "<"];

  if (docPaths.length === 0) {
    findings.push({
      id: "SCAN-000",
      severity: "warning",
      path: docType === "srs" ? `docs/srs/${primaryLanguage(config).code}/` : `docs/`,
      message: "No generated documents found to scan",
      suggestion: "Generate documents first, or pass explicit paths to readiness_scan",
    });
  }

  for (const absPath of docPaths) {
    if (!(await pathExists(absPath))) continue;
    const relPath = absPath.replace(root + "/", "");
    const content = await readFile(absPath, "utf8");
    const fileName = basename(absPath);

    const rule = matchRuleForFile(absPath, completeness?.rules);
    if (rule?.requiredHeadings?.length) {
      const missing = findMissingHeadings(content, rule.requiredHeadings);
      for (const h of missing) {
        findings.push({
          id: "COMP-HEADING",
          severity: "error",
          path: relPath,
          message: `Missing required heading: ${h}`,
          suggestion: `Add section "${h}" to match completeness rules for profile "${effectiveProfile}"`,
          rule: rule.target,
        });
      }
    }

    const placeholders = findDisallowedPlaceholders(content, disallow);
    for (const ph of placeholders) {
      findings.push({
        id: "COMP-PLACEHOLDER",
        severity: ph === "TODO" || ph === "TBD" ? "warning" : "error",
        path: relPath,
        message: `Disallowed placeholder or marker: ${ph}`,
        suggestion: "Replace with final content or move open items to context store / clarify queue",
      });
    }

    for (const section of findEmptySections(content)) {
      findings.push({
        id: "COMP-EMPTY",
        severity: "warning",
        path: relPath,
        message: `Section appears empty: ${section}`,
        suggestion: "Add content or mark as intentionally N/A with user-approved assumption in context store",
      });
    }

    if (effectiveProfile !== "general") {
      findings.push(...scanProfileGaps(relPath, content, effectiveProfile));
    }

    const blockingCriteria = merged.criteria.globalCriteria.filter((c) => c.severity === "blocking");
    for (const c of blockingCriteria.slice(0, 3)) {
      if (c.field && !content.toLowerCase().includes(c.field.toLowerCase().replace(/_/g, " "))) {
        const fieldWord = c.field.replace(/([A-Z])/g, " $1").trim();
        if (fieldWord.length > 4 && !new RegExp(fieldWord.split("_").join("|"), "i").test(content)) {
          // light heuristic — only for top-level chapter files
          if (/^[1-9]-/.test(fileName)) {
            findings.push({
              id: `CRIT-${c.id}`,
              severity: "suggestion",
              path: relPath,
              message: `Profile "${effectiveProfile}" blocking criterion ${c.id} may need coverage in this chapter`,
              suggestion: c.question,
              criterionId: c.id,
              profile: effectiveProfile,
            });
          }
        }
      }
    }
  }

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const suggestionCount = findings.filter((f) => f.severity === "suggestion").length;

  const suggestionsForUser = [
    ...new Set(findings.map((f) => f.suggestion)),
  ];

  let configUpdated = false;
  if (opts.updateLastScan) {
    await persistReadinessLastScan(root, docType, effectiveProfile);
    configUpdated = true;
  }

  return {
    docType,
    profile: effectiveProfile,
    profileSource,
    scannedAt: new Date().toISOString(),
    documentsScanned: docPaths.length,
    ok: errorCount === 0,
    errorCount,
    warningCount,
    suggestionCount,
    findings,
    suggestionsForUser,
    configUpdated,
  };
}
