import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig, primaryLanguage } from "../config/load.js";
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

export type CheckSeverity = "error" | "warning";

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
  { id: "STRUCT-003", severity: "warning" },
  { id: "STRUCT-004", severity: "error" },
  { id: "CFG-001", severity: "error" },
  { id: "TMPL-001", severity: "warning" },
  { id: "CTX-001", severity: "warning" },
  { id: "TASK-001", severity: "warning" },
  { id: "TASK-002", severity: "warning" },
  { id: "TASK-003", severity: "warning" },
  { id: "GRAPH-001", severity: "warning" },
  { id: "PACK-001", severity: "warning" },
  { id: "READY-001", severity: "warning" },
  { id: "READY-002", severity: "warning" },
];

interface TaskIndexForCheck {
  active?: Record<string, string>;
}

interface TaskForCheck {
  planApprovedAt?: string | null;
  status?: string;
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
  const cfgPath = join(root, ".ai-spector/.docflow/config/workspace.rules.json");
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

  // Load config once for downstream rules.
  let config: DocflowConfig | undefined;
  let configReadable = false;
  const configPath = ".ai-spector/docflow.config.json";
  if (await pathExists(join(root, configPath))) {
    try {
      const loaded = await loadDocflowConfig(root);
      config = loaded.config;
      configReadable = true;
    } catch (e) {
      if (enabled(rules, "STRUCT-002")) {
        add({
          ruleId: "STRUCT-002",
          severity: severityOf(rules, "STRUCT-002", "error"),
          message: `docflow.config.json is present but not parseable: ${e instanceof Error ? e.message : String(e)}`,
          path: configPath,
        });
      }
    }
  } else if (enabled(rules, "STRUCT-002")) {
    add({
      ruleId: "STRUCT-002",
      severity: severityOf(rules, "STRUCT-002", "error"),
      message: "docflow.config.json is missing — workspace is not initialized.",
      path: configPath,
      fix: "npx ai-spector init",
    });
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

  // CFG-001 — languages configured. Read the RAW config: loadDocflowConfig
  // silently substitutes a default language for an empty array, so we must
  // inspect the file as written to catch a genuinely unconfigured project.
  if (enabled(rules, "CFG-001") && configReadable) {
    let rawLangs: unknown;
    try {
      const raw = await readJson<{ languages?: unknown }>(join(root, configPath));
      rawLangs = raw.languages;
    } catch {
      rawLangs = undefined;
    }
    if (!Array.isArray(rawLangs) || rawLangs.length === 0) {
      add({
        ruleId: "CFG-001",
        severity: severityOf(rules, "CFG-001", "error"),
        message: "No output languages configured (languages[] is empty or missing).",
        path: configPath,
        fix: "npx ai-spector lang add <code>",
      });
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

  // TMPL-001 — templates dir present.
  if (enabled(rules, "TMPL-001")) {
    const rel = ".ai-spector/templates";
    if (!(await pathExists(join(root, rel)))) {
      add({
        ruleId: "TMPL-001",
        severity: severityOf(rules, "TMPL-001", "warning"),
        message: "No templates directory found — generation will have no structure to follow.",
        path: rel,
        fix: "npx ai-spector init",
      });
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

  // READY-001 — readiness not explicitly configured in docflow.config.json.
  if (enabled(rules, "READY-001") && config) {
    const readinessStatus = await resolveReadinessConfigStatus({ root });
    if (!readinessStatus.configured) {
      add({
        ruleId: "READY-001",
        severity: severityOf(rules, "READY-001", "warning"),
        message:
          "Readiness profile not configured — set readiness.profile in docflow.config.json (MCP: readiness_config).",
        path: readinessStatus.configPath,
        fix: 'Add { "readiness": { "profile": "general" | "regulated" | "arc42" } } to docflow.config.json',
      });
    }
  }

  // READY-002 — profile changed since last document scan.
  if (enabled(rules, "READY-002") && config) {
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
  if (enabled(rules, "GRAPH-001") && configReadable && config) {
    const graphRel = config.paths.graph;
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

  const ok = !findings.some((f) => f.severity === "error" && !f.fixed);
  return { ok, projectRoot: root, findings, checkedAt: new Date().toISOString() };
}
