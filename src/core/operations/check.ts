import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { workspaceRulesPath } from "../config/docflow-paths.js";
import { loadDocflowConfig, primaryLanguage } from "../config/load.js";
import { legacyDocflowLanguageDiffersFromDocops } from "../config/language-from-docops.js";
import { readDocopsConfig } from "../docops/config.js";
import {
  DOCOPS_CONFIG_REL,
  LEGACY_DOCFLOW_CONFIG_REL,
} from "../docops/paths.js";
import { isCapabilityEnabled } from "../engine/gate.js";
import { loadEngineConfig } from "../engine/load.js";
import { ENGINE_CONFIG_REL } from "../engine/paths.js";
import type { DocopsConfig } from "../docops/types.js";
import type { EngineConfig } from "../engine/types.js";
import { discoverMarkdownFiles } from "../index/docs-build.js";
import {
  isMisplacedBuiltinDocPath,
  suggestLocalizedPath,
} from "../paths/localized-output.js";
import type { PackManifest } from "../config/types.js";
import {
  activeSlotForDocType,
  generateSlotFromDocPath,
  generateSlotFromPackOutputs,
  GENERATE_DOC_TYPES,
  slotToDocTypeLabel,
  workflowForDocType,
  workflowForPackDocType,
  type GenerateDocType,
} from "./task-templates.js";
import { resolveReadinessConfigStatus } from "../readiness/config.js";
import { validateCustomPack } from "../template/pack-validate.js";
import { pathExists, readJson } from "../util/fs.js";
import type { DocflowConfig } from "../config/types.js";
import { listApprovedTaskGateViolations } from "./task-gates.js";
import type { TaskState } from "./task.js";
import type { SourceMode } from "./derive.js";
import { evaluateWorkflowStep } from "../workflow/dependencies.js";
import { loadBaseline } from "../sync/baseline.js";
import { discoverDesignLayerFiles } from "../sync/discover.js";
import { quickHasDesignLayerDrift } from "../sync/hash-diff.js";

export type CheckSeverity = "error" | "warning" | "info";

export interface CheckFinding {
  ruleId: string;
  severity: CheckSeverity;
  message: string;
  /** Offending file or directory (relative to project root). */
  path?: string;
  /** Human-readable remediation hint. */
  fix?: string;
  /** True if `runCheck({ fix: true })` can repair it automatically. */
  autoFixable?: boolean;
  /** Set when --fix repaired the finding in this run. */
  fixed?: boolean;
}

export interface CheckResult {
  /** False when any error-severity finding remains unfixed. */
  ok: boolean;
  projectRoot: string;
  findings: CheckFinding[];
  checkedAt: string;
}

export interface CheckOptions {
  root?: string;
  /** Attempt to repair autoFixable findings. */
  fix?: boolean;
  /** Validate specific output paths (e.g. after writing a generated doc). */
  paths?: string[];
  /** Workflow step id from workflow.dependencies.json (e.g. generate-srs). */
  workflow?: string;
  /** forward (default) or derive-downstream when evaluating workflow prerequisites. */
  sourceMode?: SourceMode;
}

/** A single structural rule. `severity` may be overridden by config. */
interface RuleConfig {
  id: string;
  severity?: CheckSeverity;
  enabled?: boolean;
}

interface WorkspaceRules {
  version: number;
  rules: RuleConfig[];
}

const DEFAULT_RULES: RuleConfig[] = [
  { id: "STRUCT-001", severity: "error" },
  { id: "STRUCT-002", severity: "error" },
  { id: "ENGINE-001", severity: "error" },
  { id: "STRUCT-003", severity: "warning" },
  { id: "STRUCT-004", severity: "error" },
  { id: "CFG-001", severity: "error" },
  { id: "CFG-002", severity: "warning" },
  { id: "TMPL-001", severity: "warning" },
  { id: "CTX-001", severity: "warning" },
  { id: "TASK-001", severity: "warning" },
  { id: "TASK-002", severity: "warning" },
  { id: "TASK-003", severity: "warning" },
  { id: "TASK-004", severity: "error" },
  { id: "GRAPH-001", severity: "warning" },
  { id: "PACK-001", severity: "warning" },
  { id: "READY-001", severity: "warning" },
  { id: "READY-002", severity: "warning" },
  { id: "DOC-LAYOUT-001", severity: "warning" },
  { id: "SYNC-001", severity: "info" },
];

interface TaskIndexForCheck {
  active?: Record<string, string>;
  recent?: string[];
}

interface TaskForCheck {
  planApprovedAt?: string | null;
  status?: string;
  kind?: string;
  workflow?: string;
  snapshot?: TaskState["snapshot"];
  contextRefs?: TaskState["contextRefs"];
  steps?: TaskState["steps"];
  goal?: TaskState["goal"];
  plan?: TaskState["plan"];
}

async function hasFlatOrMisplacedSrsBdDocs(
  root: string,
  config: DocflowConfig,
): Promise<boolean> {
  const langCodes = config.languages.map((l) => l.code);
  for (const docType of ["srs", "basic-design"] as const) {
    const sourceRoot = `docs/${docType}`;
    if (!(await pathExists(join(root, sourceRoot)))) continue;
    const files = await discoverMarkdownFiles(root, sourceRoot);
    for (const file of files) {
      const name = file.relativePath.split("/").pop() ?? "";
      if (name.toLowerCase() === "readme.md") continue;
      if (isMisplacedBuiltinDocPath(file.relativePath, langCodes)) {
        return true;
      }
    }
  }
  return false;
}

async function loadTaskIndexForCheck(root: string): Promise<TaskIndexForCheck> {
  const indexPath = join(root, ".ai-spector/.docflow/tasks/index.json");
  if (!(await pathExists(indexPath))) return { active: {} };
  return readJson<TaskIndexForCheck>(indexPath).catch(() => ({ active: {} }));
}

async function loadTaskForCheck(root: string, taskId: string): Promise<TaskForCheck | null> {
  const taskPath = join(root, ".ai-spector/.docflow/tasks", `${taskId}.json`);
  if (!(await pathExists(taskPath))) return null;
  return readJson<TaskForCheck>(taskPath).catch(() => null);
}

async function listLocalizedGenerateDocs(
  root: string,
  docType: GenerateDocType,
): Promise<string[]> {
  const sourceRoot = `docs/${docType}`;
  if (!(await pathExists(join(root, sourceRoot)))) return [];
  const files = await discoverMarkdownFiles(root, sourceRoot);
  return files
    .map((f) => f.relativePath)
    .filter((p) => {
      const parts = p.split("/");
      if (parts.length < 4) return false;
      const name = parts[parts.length - 1] ?? "";
      return name.toLowerCase() !== "readme.md";
    });
}

function addGenerateTaskFinding(
  add: (f: CheckFinding) => void,
  rules: RuleConfig[],
  ruleId: "TASK-002" | "TASK-003",
  defaultSeverity: CheckSeverity,
  slot: string,
  docType: string,
  path: string,
  reason: "missing" | "no-plan",
  taskId?: string,
  activePack?: string,
): void {
  const workflow =
    docType === "srs" || docType === "basic-design"
      ? workflowForDocType(docType as GenerateDocType)
      : workflowForPackDocType(docType, activePack);
  const fix =
    reason === "missing"
      ? `task_create({ kind: "generate", workflow: "${workflow}", docType: "${docType}", trigger: "…" }) or npx ai-spector task create -k generate -w ${workflow} -t "…" --doc-type ${docType}`
      : `task_approve_plan({ taskId: "${taskId}" }) or npx ai-spector task approve ${taskId}`;
  const message =
    reason === "missing"
      ? `Generated ${docType} docs exist but no active task tracks slot "${slot}" — workflow state is missing.`
      : `Active ${slot} task ${taskId} has no approved plan — generate writes require task_approve_plan first.`;
  add({
    ruleId,
    severity: severityOf(rules, ruleId, defaultSeverity),
    message,
    path,
    fix,
  });
}

async function checkGenerateTaskGate(
  add: (f: CheckFinding) => void,
  rules: RuleConfig[],
  ruleId: "TASK-002" | "TASK-003",
  defaultSeverity: CheckSeverity,
  index: TaskIndexForCheck,
  root: string,
  slot: string,
  docType: string,
  path: string,
  activePack?: string,
): Promise<void> {
  const activeId = index.active?.[slot];
  if (!activeId) {
    addGenerateTaskFinding(add, rules, ruleId, defaultSeverity, slot, docType, path, "missing", undefined, activePack);
    return;
  }
  const task = await loadTaskForCheck(root, activeId);
  if (!task) {
    addGenerateTaskFinding(add, rules, ruleId, defaultSeverity, slot, docType, path, "missing", undefined, activePack);
    return;
  }
  if (task.status === "complete" || task.status === "abandoned") {
    addGenerateTaskFinding(add, rules, ruleId, defaultSeverity, slot, docType, path, "missing", undefined, activePack);
    return;
  }
  if (!task.planApprovedAt) {
    addGenerateTaskFinding(
      add,
      rules,
      ruleId,
      defaultSeverity,
      slot,
      docType,
      path,
      "no-plan",
      activeId,
      activePack,
    );
    return;
  }

  const violations = listApprovedTaskGateViolations(task as TaskState);
  if (violations.length > 0 && enabled(rules, "TASK-004")) {
    add({
      ruleId: "TASK-004",
      severity: severityOf(rules, "TASK-004", "error"),
      message: `Active ${slot} task ${activeId} has planApprovedAt but skipped workflow gates: ${violations.join("; ")}`,
      path: `.ai-spector/.docflow/tasks/${activeId}.json`,
      fix: `task_abandon({ taskId: "${activeId}", reason: "invalid gate state" }) then restart from check → clarify → briefing → plan`,
    });
  }
}

async function loadActivePackManifest(
  root: string,
  config: DocflowConfig,
): Promise<{ packName: string; manifest: PackManifest } | null> {
  const packName = config.packs?.srs;
  if (!packName || packName === "builtin") return null;
  const manifestPath = join(root, ".ai-spector", "packs", packName, "manifest.json");
  if (!(await pathExists(manifestPath))) return null;
  const manifest = await readJson<PackManifest>(manifestPath).catch(() => null);
  if (!manifest) return null;
  return { packName, manifest };
}

async function listPackGenerateDocs(
  root: string,
  manifest: PackManifest,
): Promise<string[]> {
  const found = new Set<string>();
  for (const doc of manifest.documents) {
    if (doc.output) {
      const rel = doc.output.replace(/\\/g, "/");
      if (await pathExists(join(root, rel))) found.add(rel);
    }
  }
  const sampleOutput = manifest.documents.find((d) => d.output)?.output;
  if (sampleOutput) {
    const dir = sampleOutput.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    if (dir && (await pathExists(join(root, dir)))) {
      const files = await discoverMarkdownFiles(root, dir);
      for (const f of files) {
        if (!f.relativePath.toLowerCase().endsWith("readme.md")) found.add(f.relativePath);
      }
    }
  }
  return [...found];
}

async function loadRules(root: string): Promise<RuleConfig[]> {
  const cfgPath = workspaceRulesPath(root);
  if (await pathExists(cfgPath)) {
    try {
      const loaded = await readJson<WorkspaceRules>(cfgPath);
      if (Array.isArray(loaded.rules) && loaded.rules.length > 0) {
        // Merge: config entries override defaults by id; defaults fill gaps.
        const byId = new Map<string, RuleConfig>();
        for (const r of DEFAULT_RULES) byId.set(r.id, { ...r });
        for (const r of loaded.rules) byId.set(r.id, { ...byId.get(r.id), ...r });
        return [...byId.values()];
      }
    } catch {
      // fall through to defaults; GRAPH/STRUCT rules still run
    }
  }
  return DEFAULT_RULES;
}

function severityOf(rules: RuleConfig[], id: string, fallback: CheckSeverity): CheckSeverity {
  return rules.find((r) => r.id === id)?.severity ?? fallback;
}

function enabled(rules: RuleConfig[], id: string): boolean {
  const r = rules.find((x) => x.id === id);
  return r ? r.enabled !== false : true;
}

function isEngineReadinessExplicitlyConfigured(raw: Partial<EngineConfig> | null | undefined): boolean {
  const readiness = raw?.readiness;
  if (!readiness) return false;
  if (readiness.profile?.trim()) return true;
  if (readiness.docTypes && Object.keys(readiness.docTypes).length > 0) return true;
  return false;
}

async function readRawEngineJson(root: string): Promise<Partial<EngineConfig> | null> {
  const engineAbs = join(root, ENGINE_CONFIG_REL);
  if (!(await pathExists(engineAbs))) return null;
  try {
    return await readJson<Partial<EngineConfig>>(engineAbs);
  } catch {
    return null;
  }
}

async function loadEngineForCheck(root: string): Promise<EngineConfig | null> {
  try {
    return await loadEngineConfig(root);
  } catch {
    return null;
  }
}

export async function runCheck(opts: CheckOptions = {}): Promise<CheckResult> {
  const root = resolve(opts.root ?? process.cwd());
  const rules = await loadRules(root);
  const findings: CheckFinding[] = [];

  const add = (f: CheckFinding) => findings.push(f);
  const fixDir = async (rel: string): Promise<boolean> => {
    if (!opts.fix) return false;
    await mkdir(join(root, rel), { recursive: true });
    return true;
  };

  // Load docops contract config (STRUCT-002, CFG-001) and synthesized docflow for legacy rules.
  let docopsConfig: DocopsConfig | undefined;
  let docopsReadable = false;
  const docopsConfigPath = DOCOPS_CONFIG_REL;
  const legacyDocflowPath = LEGACY_DOCFLOW_CONFIG_REL;
  const docopsAbs = join(root, docopsConfigPath);
  const legacyDocflowAbs = join(root, legacyDocflowPath);
  const hasDocopsFile = await pathExists(docopsAbs);
  const hasLegacyDocflow = await pathExists(legacyDocflowAbs);

  if (hasDocopsFile) {
    try {
      docopsConfig = (await readDocopsConfig(root)) ?? undefined;
      docopsReadable = !!docopsConfig;
    } catch (e) {
      if (enabled(rules, "STRUCT-002")) {
        add({
          ruleId: "STRUCT-002",
          severity: severityOf(rules, "STRUCT-002", "error"),
          message: `docops.config.json is present but not parseable: ${e instanceof Error ? e.message : String(e)}`,
          path: docopsConfigPath,
        });
      }
    }
  } else if (enabled(rules, "STRUCT-002")) {
    add({
      ruleId: "STRUCT-002",
      severity: severityOf(rules, "STRUCT-002", "error"),
      message: "docops.config.json is missing — workspace is not initialized.",
      path: docopsConfigPath,
      fix: hasLegacyDocflow
        ? "npx ai-spector docops migrate --from-docflow"
        : "npx ai-spector init",
    });
  }

  if (!docopsReadable && hasLegacyDocflow && enabled(rules, "STRUCT-002")) {
    add({
      ruleId: "STRUCT-002",
      severity: "warning",
      message:
        "Legacy docflow.config.json found without docops.config.json — migrate to the Writer contract.",
      path: legacyDocflowPath,
      fix: "npx ai-spector docops migrate --from-docflow",
    });
  }

  // ENGINE-001 — engine.json parseable when .ai-spector/ exists.
  if (enabled(rules, "ENGINE-001") && (await pathExists(join(root, ".ai-spector")))) {
    const engineAbs = join(root, ENGINE_CONFIG_REL);
    if (await pathExists(engineAbs)) {
      try {
        await readJson(engineAbs);
      } catch (e) {
        add({
          ruleId: "ENGINE-001",
          severity: severityOf(rules, "ENGINE-001", "error"),
          message: `engine.json is present but not parseable: ${e instanceof Error ? e.message : String(e)}`,
          path: ENGINE_CONFIG_REL,
          fix: "Restore engine.json from backup or re-run docops migrate --from-docflow.",
        });
      }
    }
  }

  let config: DocflowConfig | undefined;
  let configReadable = false;
  if (hasDocopsFile || hasLegacyDocflow) {
    try {
      const loaded = await loadDocflowConfig(root);
      config = loaded.config;
      configReadable = true;
    } catch {
      // STRUCT-002 / ENGINE-001 already surface parse failures.
    }
  }

  // STRUCT-001 — required directories.
  if (enabled(rules, "STRUCT-001")) {
    const required = ["docs/data-source", ".ai-spector/.docflow/config"];
    for (const rel of required) {
      if (!(await pathExists(join(root, rel)))) {
        const fixed = await fixDir(rel);
        add({
          ruleId: "STRUCT-001",
          severity: severityOf(rules, "STRUCT-001", "error"),
          message: `Required directory missing: ${rel}`,
          path: rel,
          fix: `mkdir -p ${rel}`,
          autoFixable: true,
          fixed,
        });
      }
    }
  }

  // CFG-001 — languages configured in docops.config.json only.
  // mergeDocopsDefaults silently substitutes a default language for an empty array,
  // so inspect the file as written to catch a genuinely unconfigured project.
  if (enabled(rules, "CFG-001") && docopsReadable) {
    let rawLangs: unknown;
    try {
      const raw = await readJson<{ languages?: unknown }>(docopsAbs);
      rawLangs = raw.languages;
    } catch {
      rawLangs = undefined;
    }
    if (!Array.isArray(rawLangs) || rawLangs.length === 0) {
      add({
        ruleId: "CFG-001",
        severity: severityOf(rules, "CFG-001", "error"),
        message: "No output languages configured (languages[] is empty or missing).",
        path: docopsConfigPath,
        fix: "npx ai-spector lang add <code>",
      });
    }
  }

  // CFG-002 — legacy docflow language fields disagree with docops contract (generation uses docops).
  if (enabled(rules, "CFG-002") && docopsReadable && hasLegacyDocflow && docopsConfig) {
    try {
      const legacyRaw = await readJson<Partial<DocflowConfig>>(legacyDocflowAbs);
      const mismatch = legacyDocflowLanguageDiffersFromDocops(docopsConfig, legacyRaw);
      if (mismatch) {
        add({
          ruleId: "CFG-002",
          severity: severityOf(rules, "CFG-002", "warning"),
          message:
            `docops primaryLanguage "${mismatch.docopsPrimary}" and languages [${mismatch.docopsCodes.join(", ")}] ` +
            `disagree with legacy docflow.config.json languages [${mismatch.legacyCodes.join(", ") || "none"}] — ` +
            "generation uses docops; sync or remove stale legacy language fields.",
          path: legacyDocflowPath,
          fix: "Update .ai-spector/docflow.config.json languages to match docops, or remove languages from legacy file.",
        });
      }
    } catch {
      // Legacy parse errors are surfaced elsewhere.
    }
  }

  // STRUCT-003 — language output folders for each configured language.
  if (enabled(rules, "STRUCT-003") && configReadable) {
    for (const lang of config?.languages ?? []) {
      for (const docType of ["srs", "basic-design"] as const) {
        const rel = `docs/${docType}/${lang.code}`;
        if (!(await pathExists(join(root, rel)))) {
          const fixed = await fixDir(rel);
          add({
            ruleId: "STRUCT-003",
            severity: severityOf(rules, "STRUCT-003", "warning"),
            message: `Output folder missing for configured language "${lang.code}": ${rel}`,
            path: rel,
            fix: `mkdir -p ${rel}`,
            autoFixable: true,
            fixed,
          });
        }
      }
    }
  }

  // STRUCT-004 — builtin SRS/BD docs must live under docs/{type}/{lang}/.
  if (enabled(rules, "STRUCT-004") && configReadable && config) {
    const langCodes = config.languages.map((l) => l.code);
    const primary = primaryLanguage(config);
    const reportMisplaced = (rel: string) => {
      const suggested = suggestLocalizedPath(rel, primary.code);
      add({
        ruleId: "STRUCT-004",
        severity: severityOf(rules, "STRUCT-004", "error"),
        message: `Document is outside the language folder — expected under docs/{type}/${primary.code}/`,
        path: rel,
        fix: `mv ${rel} ${suggested}`,
      });
    };

    const explicitPaths = [...new Set((opts.paths ?? []).map((p) => p.replace(/\\/g, "/")))];
    for (const rel of explicitPaths) {
      if (isMisplacedBuiltinDocPath(rel, langCodes)) {
        reportMisplaced(rel);
      }
    }

    if (explicitPaths.length === 0) {
      for (const docType of ["srs", "basic-design"] as const) {
        const sourceRoot = `docs/${docType}`;
        if (!(await pathExists(join(root, sourceRoot)))) continue;
        const files = await discoverMarkdownFiles(root, sourceRoot);
        for (const file of files) {
          if (isMisplacedBuiltinDocPath(file.relativePath, langCodes)) {
            reportMisplaced(file.relativePath);
          }
        }
      }
    }
  }

  // DOC-LAYOUT-001 — non-canonical doc layout; self-service migration via docops layout + guide.
  if (enabled(rules, "DOC-LAYOUT-001") && configReadable && config) {
    const needsLayoutHelp = await hasFlatOrMisplacedSrsBdDocs(root, config);
    if (needsLayoutHelp) {
      add({
        ruleId: "DOC-LAYOUT-001",
        severity: severityOf(rules, "DOC-LAYOUT-001", "warning"),
        message:
          "Doc folders may not match Writer conventions — run docops layout and edit docTypes paths in docops.config.json",
        fix: "npx ai-spector docops layout --prompt",
      });
    }
  }

  // TMPL-001 — templatesPath folder exists per enabled docTypes (generate capability).
  if (
    enabled(rules, "TMPL-001") &&
    docopsReadable &&
    docopsConfig &&
    isCapabilityEnabled(docopsConfig, "generate")
  ) {
    const docTypes = docopsConfig.docTypes ?? {};
    for (const [docTypeKey, docType] of Object.entries(docTypes)) {
      if (!docType.enabled || !docType.templatesPath?.trim()) continue;
      const rel = docType.templatesPath.trim();
      if (!(await pathExists(join(root, rel)))) {
        add({
          ruleId: "TMPL-001",
          severity: severityOf(rules, "TMPL-001", "warning"),
          message: `Templates folder missing for enabled docType "${docTypeKey}": ${rel}`,
          path: rel,
          fix: "npx ai-spector init or create the templates directory for this doc type.",
        });
      }
    }
  }

  // CTX-001 — context store dir (created lazily; warn-only) and stale entries.
  if (enabled(rules, "CTX-001")) {
    const rel = ".ai-spector/.docflow/context";
    if (!(await pathExists(join(root, rel)))) {
      const fixed = await fixDir(rel);
      add({
        ruleId: "CTX-001",
        severity: severityOf(rules, "CTX-001", "warning"),
        message: "Context store directory does not exist yet (no clarifications recorded).",
        path: rel,
        autoFixable: true,
        fixed,
      });
    } else {
      // Surface answers invalidated by source changes (flipped by `index`).
      const files = (await readdir(join(root, rel)).catch(() => [] as string[])).filter((f) =>
        f.endsWith(".json"),
      );
      for (const file of files) {
        const store = await readJson<{ docType?: string; entries?: { id: string; status: string }[] }>(
          join(root, rel, file),
        ).catch(() => undefined);
        const stale = store?.entries?.filter((e) => e.status === "stale") ?? [];
        if (stale.length > 0) {
          const docType = store?.docType ?? file.slice(0, -".json".length);
          add({
            ruleId: "CTX-001",
            severity: severityOf(rules, "CTX-001", "warning"),
            message: `${stale.length} stale clarification(s) for "${docType}" (${stale
              .map((e) => e.id)
              .join(", ")}) — source files changed since they were answered.`,
            path: `${rel}/${file}`,
            fix: `Re-confirm with the user, then: npx ai-spector context resolve ${docType} <id> --answer "..."`,
          });
        }
      }
    }
  }

  const activePackInfo = config ? await loadActivePackManifest(root, config) : null;

  // PACK-001 — custom pack install setup incomplete (validate gaps + user questions).
  if (enabled(rules, "PACK-001") && activePackInfo) {
    const validation = await validateCustomPack({
      root,
      packName: activePackInfo.packName,
    });
    if (!validation.ready) {
      const setupPath = join(
        root,
        ".ai-spector",
        "packs",
        activePackInfo.packName,
        "pack-setup.json",
      );
      const relSetup = setupPath.replace(root + "/", "");
      add({
        ruleId: "PACK-001",
        severity: severityOf(rules, "PACK-001", "warning"),
        message: `Custom pack "${activePackInfo.packName}" setup incomplete — ${validation.blockingCount} blocking gap(s). Run template verify before first generate.`,
        path: relSetup,
        fix: `npx ai-spector template verify ${activePackInfo.packName} --json`,
      });
      for (const q of validation.questionsForUser.slice(0, 5)) {
        add({
          ruleId: "PACK-001",
          severity: severityOf(rules, "PACK-001", "warning"),
          message: `Ask user: ${q}`,
          path: relSetup,
        });
      }
      if (validation.questionsForUser.length > 5) {
        add({
          ruleId: "PACK-001",
          severity: severityOf(rules, "PACK-001", "warning"),
          message: `…and ${validation.questionsForUser.length - 5} more question(s) — see template verify --json`,
          path: relSetup,
        });
      }
    }
  }

  // READY-001 — readiness profile configured in engine.json (raw file, not merged defaults).
  if (enabled(rules, "READY-001") && docopsReadable && docopsConfig) {
    const rawEngine = await readRawEngineJson(root);
    const engineAbs = join(root, ENGINE_CONFIG_REL);
    if (rawEngine !== null || !(await pathExists(engineAbs))) {
      if (!isEngineReadinessExplicitlyConfigured(rawEngine)) {
        add({
          ruleId: "READY-001",
          severity: severityOf(rules, "READY-001", "warning"),
          message:
            "Readiness profile not configured — set readiness.profile in engine.json (MCP: readiness_config).",
          path: ENGINE_CONFIG_REL,
          fix: 'Add { "readiness": { "profile": "general" | "regulated" | "arc42" } } to .ai-spector/engine.json',
        });
      }
    }
  }

  // READY-002 — profile changed since last document scan.
  if (enabled(rules, "READY-002") && config) {
    try {
      const readinessStatus = await resolveReadinessConfigStatus({ root });
      if (readinessStatus.profileDrift.detected) {
        add({
          ruleId: "READY-002",
          severity: severityOf(rules, "READY-002", "warning"),
          message: readinessStatus.profileDrift.message ?? "Readiness profile drift — rescan documents.",
          path: readinessStatus.configPath,
          fix: "MCP: readiness_scan({ updateLastScan: true }) after updating documents",
        });
      }
    } catch {
      // Unparseable engine.json — ENGINE-001 surfaces the blocking issue.
    }
  }

  // TASK-002 — generated SRS/BD docs without active tracked task (workspace scan).
  if (enabled(rules, "TASK-002")) {
    const index = await loadTaskIndexForCheck(root);
    for (const docType of GENERATE_DOC_TYPES) {
      const docs = await listLocalizedGenerateDocs(root, docType);
      if (docs.length === 0) continue;
      const slot = activeSlotForDocType(docType);
      await checkGenerateTaskGate(
        add,
        rules,
        "TASK-002",
        "warning",
        index,
        root,
        slot,
        docType,
        docs[0]!,
      );
    }
    if (activePackInfo) {
      const packDocs = await listPackGenerateDocs(root, activePackInfo.manifest);
      if (packDocs.length > 0) {
        const slot = `generate:${activePackInfo.packName}`;
        await checkGenerateTaskGate(
          add,
          rules,
          "TASK-002",
          "warning",
          index,
          root,
          slot,
          activePackInfo.packName,
          packDocs[0]!,
          activePackInfo.packName,
        );
      }
    }
  }

  // TASK-003 — explicit doc path writes require approved active generate task.
  if (enabled(rules, "TASK-003") && (opts.paths?.length ?? 0) > 0) {
    const index = await loadTaskIndexForCheck(root);
    const explicitPaths = [...new Set((opts.paths ?? []).map((p) => p.replace(/\\/g, "/")))];
    const checkedSlots = new Set<string>();
    for (const rel of explicitPaths) {
      let slot = generateSlotFromDocPath(rel);
      if (!slot && activePackInfo) {
        slot = generateSlotFromPackOutputs(
          rel,
          activePackInfo.packName,
          activePackInfo.manifest.documents,
        );
      }
      if (!slot || checkedSlots.has(slot)) continue;
      checkedSlots.add(slot);
      const docType = slotToDocTypeLabel(slot);
      if (!docType) continue;
      await checkGenerateTaskGate(
        add,
        rules,
        "TASK-003",
        "warning",
        index,
        root,
        slot,
        docType,
        rel,
        activePackInfo?.packName,
      );
    }
  }

  // TASK-001 — in-flight workflow tasks (active / paused / blocked).
  if (enabled(rules, "TASK-001")) {
    const indexPath = join(root, ".ai-spector/.docflow/tasks/index.json");
    if (await pathExists(indexPath)) {
      const index = await readJson<{ active?: Record<string, string> }>(indexPath).catch(
        () => ({ active: {} }),
      );
      for (const [slot, taskId] of Object.entries(index.active ?? {})) {
        const taskPath = join(root, ".ai-spector/.docflow/tasks", `${taskId}.json`);
        if (!(await pathExists(taskPath))) continue;
        const task = await readJson<{
          status?: string;
          blockers?: string[];
          trigger?: string;
        }>(taskPath).catch(() => null);
        if (!task) continue;
        const status = task.status ?? "unknown";
        if (status === "complete" || status === "abandoned") continue;
        const blockerNote =
          task.blockers && task.blockers.length > 0
            ? ` Blockers: ${task.blockers.join("; ")}`
            : "";
        add({
          ruleId: "TASK-001",
          severity: severityOf(rules, "TASK-001", "warning"),
          message: `Workflow task in progress (${slot}): ${taskId} [${status}] — ${task.trigger ?? "no trigger"}.${blockerNote}`,
          path: `.ai-spector/.docflow/tasks/${taskId}.json`,
          fix: `npx ai-spector task get ${taskId} or task resume ${taskId}`,
        });
      }
    }
  }

  // GRAPH-001 — graph.json parses (shallow; defers to `graph validate`).
  if (
    enabled(rules, "GRAPH-001") &&
    docopsReadable &&
    docopsConfig &&
    isCapabilityEnabled(docopsConfig, "graph")
  ) {
    const engine = await loadEngineForCheck(root);
    if (engine) {
      const graphRel = engine.artifacts.graph;
      const graphAbs = join(root, graphRel);
      if (await pathExists(graphAbs)) {
        try {
          await readJson(graphAbs);
        } catch (e) {
          add({
            ruleId: "GRAPH-001",
            severity: severityOf(rules, "GRAPH-001", "warning"),
            message: `graph.json is present but not parseable: ${e instanceof Error ? e.message : String(e)}`,
            path: graphRel,
            fix: "Re-run analyze/merge or restore from a known-good graph.",
          });
        }
      }
    }
  }

  // SYNC-001 — lightweight design-layer drift hint when a sync baseline exists.
  if (enabled(rules, "SYNC-001")) {
    const baseline = await loadBaseline(root);
    if (baseline) {
      const currentLayers = await discoverDesignLayerFiles(root);
      if (quickHasDesignLayerDrift(baseline, currentLayers)) {
        add({
          ruleId: "SYNC-001",
          severity: severityOf(rules, "SYNC-001", "info"),
          message: "Design layer drift detected — run sync audit",
          fix: "npx ai-spector sync audit --json",
        });
      }
    }
  }

  if (opts.workflow) {
    const wf = await evaluateWorkflowStep(root, {
      stepId: opts.workflow,
      sourceMode: opts.sourceMode,
    });
    for (const failure of wf.failures) {
      add({
        ruleId: `DERIVE-001-${failure.id}`,
        severity: "error",
        message: failure.message,
        fix:
          opts.sourceMode === "derive-downstream"
            ? "Index downstream design docs and ensure graph has domain nodes."
            : "Complete upstream workflow steps before generate.",
      });
    }
  }

  const ok = !findings.some((f) => f.severity === "error" && !f.fixed);
  return { ok, projectRoot: root, findings, checkedAt: new Date().toISOString() };
}
