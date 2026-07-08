import { join } from "node:path";
import { assessDocopsProject, type DocopsAssessment, type DocopsGap } from "./assess.js";
import { checkDocopsConfig } from "./check.js";
import { mergeDocopsDefaults, readDocopsConfig } from "./config.js";
import { LAYER_DEFAULTS, OPTIONAL_DISABLED_LAYERS } from "./layer-defaults.js";
import { probeDocopsLayout } from "./layout.js";
import { migrateDocopsLayout } from "./migrate.js";
import { packagedContractsRoot, resolveBootstrapRoot } from "./bootstrap.js";
import {
  DEFAULT_DOCOPS_PATHS,
  DOCOPS_CONFIG_REL,
  LEGACY_DOCFLOW_CONFIG_REL,
  isNonCanonicalDocTypePath,
  normalizeDocTypePath,
} from "./paths.js";
import type { DocopsConfig } from "./types.js";
import { pathExists } from "../util/fs.js";

const LAYER_KEYS = ["srs", "basicDesign", "detailDesign"] as const;
type LayerKey = (typeof LAYER_KEYS)[number];

export interface DocopsGuideTask {
  id: string;
  priority: number;
  task: string;
  rationale?: string;
}

export interface DocopsGuideTargetDocType {
  enabled: boolean;
  path: string;
  templatesPath?: string;
}

export interface DocopsGuideWrongVsCorrect {
  field: string;
  wrong?: string;
  correct: string;
  reason: string;
}

export interface DocopsGuideExamples {
  /** Full example docops.config.json for this repo (merge into existing — do not blind replace). */
  docopsConfig: Record<string, unknown>;
  /** Common mistakes vs what this project should use. */
  wrongVsCorrect: DocopsGuideWrongVsCorrect[];
  /** Example markdown paths that should resolve given correct config. */
  documentPaths: string[];
  /** Contract files that should exist under .docops/ */
  scaffoldPaths: string[];
  /** engine.json snippet when upgrading from legacy docflow. */
  engineJson?: Record<string, unknown>;
  /** Paths inside the ai-spector npm package (standalone CLI bundle). */
  bundle: {
    bootstrapRoot: string;
    contractsRoot: string;
  };
  /** Gap-fill copy map: bootstrap source → project destination. */
  bootstrapCopyMap: Array<{ source: string; destination: string }>;
}

export interface DocopsGuideCurrentState {
  layout: DocopsAssessment["layout"];
  writerReady: boolean;
  configExists: boolean;
  configPath: string;
  legacyPathsFound: string[];
  docopsPathsFound: string[];
  onDiskDocRoots: Partial<Record<string, string>>;
  missingScaffold: string[];
  configValid: boolean;
}

export interface DocopsMigrateGuideResult {
  generatedAt: string;
  layout: DocopsAssessment["layout"];
  writerReady: boolean;
  recommendedAction: DocopsAssessment["recommendedAction"];
  currentState: DocopsGuideCurrentState;
  cli: {
    primaryCommand: string;
    fallbackCommand: string;
    autoRepairWouldRun: boolean;
    blockers: string[];
    repairPreview: string[];
  };
  gaps: DocopsGap[];
  layoutSuggestions: string[];
  targetState: {
    docTypes: Partial<Record<string, DocopsGuideTargetDocType>>;
    notes: string[];
    examples: DocopsGuideExamples;
  };
  agentTasks: DocopsGuideTask[];
  verifyCommands: string[];
  referenceGuides: string[];
  agentPrompt: string;
}

function recommendedCliCommand(action: DocopsAssessment["recommendedAction"]): string {
  switch (action) {
    case "init":
      return "npx ai-spector docops init";
    case "migrate":
      return "npx ai-spector docops migrate";
    case "repair":
      return "npx ai-spector docops migrate --repair";
    default:
      return "npx ai-spector docops status";
  }
}

function inferTargetPath(
  key: LayerKey,
  configuredPath: string | undefined,
  onDiskRoots: Array<{ path: string; fileCount: number }>,
  docsRoot: string,
): { path: string; note?: string } {
  const fallback = LAYER_DEFAULTS[key]?.path ?? `docs/${key}`;
  const primary = onDiskRoots.reduce(
    (best, root) => (root.fileCount > best.fileCount ? root : best),
    { path: "", fileCount: 0 },
  );

  if (primary.fileCount > 0) {
    const canonical = normalizeDocTypePath(key, primary.path, docsRoot);
    if (configuredPath && configuredPath !== canonical) {
      return {
        path: canonical,
        note: `Docs found under ${primary.path} (${primary.fileCount} file(s)) — point docTypes.${key}.path here; do not move markdown.`,
      };
    }
    return { path: canonical };
  }

  if (configuredPath?.trim()) {
    return { path: normalizeDocTypePath(key, configuredPath, docsRoot) };
  }

  return { path: fallback };
}

function buildTargetState(
  assessment: DocopsAssessment,
  layout: Awaited<ReturnType<typeof probeDocopsLayout>>,
  config: DocopsConfig | null,
  gaps: DocopsGap[],
): DocopsMigrateGuideResult["targetState"] {
  const docsRoot = config?.docsRoot?.trim() || "docs";
  const docTypes: Partial<Record<string, DocopsGuideTargetDocType>> = {};
  const notes: string[] = [];

  for (const key of LAYER_KEYS) {
    const existing = config?.docTypes?.[key];
    const onDisk = layout.onDisk[key];
    const inferred = inferTargetPath(
      key,
      existing?.path,
      onDisk?.roots ?? [],
      docsRoot,
    );
    if (inferred.note) notes.push(inferred.note);

    const hasDocs = (onDisk?.roots ?? []).some((r) => r.fileCount > 0);
    docTypes[key] = {
      enabled: existing?.enabled ?? (hasDocs ? true : key !== "detailDesign"),
      path: inferred.path,
      templatesPath:
        existing?.templatesPath?.trim() ||
        LAYER_DEFAULTS[key]?.templatesPath,
    };
  }

  for (const key of OPTIONAL_DISABLED_LAYERS) {
    if (docTypes[key]) continue;
    const base = LAYER_DEFAULTS[key];
    if (!base) continue;
    docTypes[key] = {
      enabled: false,
      path: base.path,
      ...(base.templatesPath ? { templatesPath: base.templatesPath } : {}),
    };
    notes.push(`docTypes.${key} must exist with enabled: false unless the project already enables it.`);
  }

  if (assessment.layout === "legacy") {
    notes.push(
      "Legacy docflow.config.json present — prefer npx ai-spector docops migrate --from-docflow only when .docops/docops.config.json is missing.",
    );
  }
  if (assessment.layout === "mixed") {
    notes.push(
      "Mixed layout — gap-fill .docops/ contract files from legacy paths; never overwrite existing destinations.",
    );
  }

  notes.push("Repo-root-relative docTypes.*.path (e.g. docs/srs) — bare srs is invalid.");
  notes.push("Do not move existing markdown — edit config to match on-disk folders.");

  const examples = buildExamples(assessment, layout, config, docTypes, gaps);

  return { docTypes, notes, examples };
}

function buildExampleDocopsConfig(
  config: DocopsConfig | null,
  docTypes: Partial<Record<string, DocopsGuideTargetDocType>>,
): Record<string, unknown> {
  const merged = mergeDocopsDefaults(config ?? {});
  const languages =
    merged.languages.length > 0
      ? merged.languages.map((l) => ({
          code: l.code,
          label: l.label,
          path: l.path ?? l.code,
        }))
      : [{ code: "en", label: "English", path: "en" }];

  const exampleDocTypes: Record<string, unknown> = {};
  for (const [key, target] of Object.entries(docTypes)) {
    if (!target) continue;
    const existing = merged.docTypes?.[key];
    exampleDocTypes[key] = {
      enabled: target.enabled,
      path: target.path,
      label: existing?.label ?? LAYER_DEFAULTS[key]?.label ?? key,
      ...(target.templatesPath ? { templatesPath: target.templatesPath } : {}),
    };
  }

  return {
    schemaVersion: "1.0",
    layout: "docops",
    docsRoot: merged.docsRoot ?? "docs",
    languages,
    primaryLanguage: merged.primaryLanguage ?? languages[0]?.code ?? "en",
    docTypes: exampleDocTypes,
    paths: { ...DEFAULT_DOCOPS_PATHS, ...merged.paths },
    capabilities: { ...merged.capabilities },
  };
}

function buildWrongVsCorrect(
  config: DocopsConfig | null,
  docTypes: Partial<Record<string, DocopsGuideTargetDocType>>,
  gaps: DocopsGap[],
): DocopsGuideWrongVsCorrect[] {
  const rows: DocopsGuideWrongVsCorrect[] = [];
  const docsRoot = config?.docsRoot?.trim() || "docs";

  for (const [key, target] of Object.entries(docTypes)) {
    if (!target) continue;
    const current = config?.docTypes?.[key]?.path?.trim();
    if (!current || current === target.path) continue;
    rows.push({
      field: `docTypes.${key}.path`,
      wrong: `"${current}"`,
      correct: `"${target.path}"`,
      reason: "Paths must be repo-root-relative (e.g. docs/srs). Writer does not expand bare segment names.",
    });
  }

  for (const gap of gaps) {
    if (gap.id.startsWith("DOCOPS-PATH-") && gap.message.includes('expected "')) {
      const match = gap.message.match(/is "([^"]+)".*expected "([^"]+)"/);
      if (match) {
        const field = gap.id.replace("DOCOPS-PATH-", "docTypes.") + ".path";
        if (!rows.some((r) => r.field === field)) {
          rows.push({
            field,
            wrong: `"${match[1]}"`,
            correct: `"${match[2]}"`,
            reason: gap.message,
          });
        }
      }
    }
  }

  if (config?.docTypes) {
    for (const [key, dt] of Object.entries(config.docTypes)) {
      if (!dt?.path?.trim() || !docTypes[key]) continue;
      const layerPath = dt.path.trim();
      if (isNonCanonicalDocTypePath(key, layerPath, docsRoot)) {
        const canonical = normalizeDocTypePath(key, layerPath, docsRoot);
        if (!rows.some((r) => r.field === `docTypes.${key}.path`)) {
          rows.push({
            field: `docTypes.${key}.path`,
            wrong: `"${layerPath}"`,
            correct: `"${canonical}"`,
            reason: "Short paths like srs are invalid — use docs/<layer>.",
          });
        }
      }
    }
  }

  for (const key of OPTIONAL_DISABLED_LAYERS) {
    if (config?.docTypes?.[key]) continue;
    const base = LAYER_DEFAULTS[key];
    if (!base) continue;
    rows.push({
      field: `docTypes.${key}`,
      wrong: "(missing)",
      correct: JSON.stringify({
        enabled: false,
        path: base.path,
        label: base.label,
        ...(base.templatesPath ? { templatesPath: base.templatesPath } : {}),
      }),
      reason: "Required optional layer — must exist in config even when disabled.",
    });
  }

  if (!config) {
    rows.push({
      field: DOCOPS_CONFIG_REL,
      wrong: "(missing)",
      correct: "(create from example docopsConfig below)",
      reason: "Writer contract manifest is required.",
    });
  }

  return rows;
}

function buildDocumentPathExamples(
  docTypes: Partial<Record<string, DocopsGuideTargetDocType>>,
  languages: Array<{ code: string; path?: string }>,
  layout: Awaited<ReturnType<typeof probeDocopsLayout>>,
): string[] {
  const paths: string[] = [];
  const primaryLang = languages[0]?.path ?? languages[0]?.code ?? "en";

  for (const key of LAYER_KEYS) {
    const target = docTypes[key];
    if (!target?.enabled) continue;

    const onDisk = layout.onDisk[key];
    const sampleRoot = onDisk?.roots.find((r) => r.fileCount > 0)?.path ?? target.path;
    const langLayout = onDisk?.languageLayout ?? "per-language";

    if (langLayout === "flat") {
      paths.push(`${sampleRoot}/01-overview.md`);
    } else {
      paths.push(`${sampleRoot}/${primaryLang}/01-overview.md`);
      if (languages.length > 1) {
        const second = languages[1]?.path ?? languages[1]?.code;
        if (second) paths.push(`${sampleRoot}/${second}/01-overview.md`);
      }
    }
  }

  return paths;
}

function buildScaffoldPathExamples(docTypes: Partial<Record<string, DocopsGuideTargetDocType>>): string[] {
  const paths = [
    ".docops/docops.config.json",
    ".docops/guide/README.md",
    ".docops/review.config.json",
    ".docops/review-queue/registry.json",
    ".docops/review-queue/pending.json",
    ".docops/comments/",
    ".docops/registry/",
    ".docops/prototype/config.json",
    ".docops/prototype/screen-map.json",
  ];

  for (const dt of Object.values(docTypes)) {
    if (dt?.templatesPath) {
      paths.push(`${dt.templatesPath}/*.md`);
    }
  }

  paths.push(".docops/templates/detail-design/*.md");
  return [...new Set(paths)];
}

async function buildCurrentState(
  projectRoot: string,
  assessment: DocopsAssessment,
  layout: Awaited<ReturnType<typeof probeDocopsLayout>>,
  check: Awaited<ReturnType<typeof checkDocopsConfig>>,
  scaffoldPaths: string[],
): Promise<DocopsGuideCurrentState> {
  const onDiskDocRoots: Partial<Record<string, string>> = {};
  for (const key of LAYER_KEYS) {
    const layer = layout.onDisk[key];
    const primary = layer?.roots.find((r) => r.fileCount > 0);
    if (primary) onDiskDocRoots[key] = primary.path;
  }

  const missingScaffold: string[] = [];
  for (const rel of scaffoldPaths) {
    const normalized = rel.replace(/\/\*\.md$/, "").replace(/\/$/, "");
    if (!(await pathExists(join(projectRoot, normalized)))) {
      missingScaffold.push(rel);
    }
  }

  return {
    layout: assessment.layout,
    writerReady: assessment.writerReady,
    configExists: check.configExists,
    configPath: check.configPath,
    legacyPathsFound: assessment.legacyPathsFound,
    docopsPathsFound: assessment.docopsPathsFound,
    onDiskDocRoots,
    missingScaffold,
    configValid: check.valid,
  };
}

function buildBootstrapCopyMap(bundleRoot: string): Array<{ source: string; destination: string }> {
  return [
    { source: `${bundleRoot}/docs/`, destination: ".docops/guide/" },
    { source: `${bundleRoot}/../schemas/`, destination: ".docops/guide/schemas/" },
    { source: `${bundleRoot}/../examples/`, destination: ".docops/guide/examples/" },
    { source: `${bundleRoot}/config/review.config.json`, destination: ".docops/review.config.json" },
    {
      source: `${bundleRoot}/config/review-queue-registry.json`,
      destination: ".docops/review-queue/registry.json",
    },
    {
      source: `${bundleRoot}/config/review-queue-pending.json`,
      destination: ".docops/review-queue/pending.json",
    },
    { source: `${bundleRoot}/config/prototype.config.json`, destination: ".docops/prototype/config.json" },
    {
      source: `${bundleRoot}/config/prototype-screen-map.json`,
      destination: ".docops/prototype/screen-map.json",
    },
    { source: `${bundleRoot}/templates/srs/`, destination: ".docops/templates/srs/" },
    { source: `${bundleRoot}/templates/basic-design/`, destination: ".docops/templates/basic-design/" },
    {
      source: `${bundleRoot}/templates/detail-design/`,
      destination: ".docops/templates/detail-design/",
    },
  ];
}

function buildExamples(
  assessment: DocopsAssessment,
  layout: Awaited<ReturnType<typeof probeDocopsLayout>>,
  config: DocopsConfig | null,
  docTypes: Partial<Record<string, DocopsGuideTargetDocType>>,
  gaps: DocopsGap[],
): DocopsGuideExamples {
  const docopsConfig = buildExampleDocopsConfig(config, docTypes);
  const languages = (docopsConfig.languages as Array<{ code: string; path?: string }>) ?? [];
  const wrongVsCorrect = buildWrongVsCorrect(config, docTypes, gaps);
  const documentPaths = buildDocumentPathExamples(docTypes, languages, layout);
  const scaffoldPaths = buildScaffoldPathExamples(docTypes);
  const bootstrapRoot = resolveBootstrapRoot();
  const contractsRoot = packagedContractsRoot();

  let engineJson: Record<string, unknown> | undefined;
  if (assessment.layout === "legacy" || assessment.layout === "mixed") {
    engineJson = {
      schemaVersion: 1,
      scaffoldVersion: "(from legacy docflow.config.json scaffoldVersion, or installed ai-spector version)",
      artifacts: {
        graph: ".ai-spector/graph/traceability.graph.json",
        registry: ".ai-spector/registry/section-registry.json",
      },
      readiness: { profile: "general" },
    };
  }

  return {
    docopsConfig,
    wrongVsCorrect,
    documentPaths,
    scaffoldPaths,
    bundle: { bootstrapRoot, contractsRoot },
    bootstrapCopyMap: buildBootstrapCopyMap(bootstrapRoot),
    ...(engineJson ? { engineJson } : {}),
  };
}

function buildAgentTasks(
  assessment: DocopsAssessment,
  check: Awaited<ReturnType<typeof checkDocopsConfig>>,
  target: DocopsMigrateGuideResult["targetState"],
  cli: DocopsMigrateGuideResult["cli"],
): DocopsGuideTask[] {
  const tasks: DocopsGuideTask[] = [];
  let priority = 1;

  if (cli.blockers.length > 0) {
    for (const blocker of cli.blockers) {
      tasks.push({
        id: `CLI-${priority}`,
        priority: priority++,
        task: blocker,
      });
    }
  }

  for (const gap of assessment.gaps.filter((g) => g.severity === "blocking")) {
    tasks.push({
      id: gap.id,
      priority: priority++,
      task: gap.fix ? `${gap.message} — ${gap.fix}` : gap.message,
      rationale: gap.fix,
    });
  }

  const pathNotes = target.notes.filter((n) => n.includes("point docTypes"));
  for (const note of pathNotes) {
    tasks.push({
      id: `PATH-${priority}`,
      priority: priority++,
      task: `Edit .docops/docops.config.json: ${note}`,
    });
  }

  if (check.configDrift || assessment.gaps.some((g) => g.id.startsWith("DOCOPS-CFG"))) {
    tasks.push({
      id: "CONFIG-MERGE",
      priority: priority++,
      task:
        "Merge missing keys into .docops/docops.config.json — use targetState.examples.docopsConfig as the correct shape (merge, do not blind replace).",
    });
  }

  if (cli.repairPreview.length > 0) {
    tasks.push({
      id: "SCAFFOLD-GAP",
      priority: priority++,
      task:
        "Gap-fill scaffold files from bootstrap bundle — copy only when destination missing (templates, review-queue, guide/). Follow .docops/guide/guides/DOCOPS_MANUAL_FALLBACK.md §3–4.",
      rationale: cli.repairPreview.slice(0, 5).join("; "),
    });
  } else if (!assessment.writerReady) {
    tasks.push({
      id: "SCAFFOLD-GAP",
      priority: priority++,
      task:
        "Run npx ai-spector docops migrate --repair --dry-run; if CLI fails, manual gap-fill per DOCOPS_MANUAL_FALLBACK.md.",
    });
  }

  for (const action of check.actions.filter((a) => a.severity === "warning")) {
    if (tasks.some((t) => t.id === action.id)) continue;
    tasks.push({
      id: action.id,
      priority: priority++,
      task: action.command
        ? `${action.message} — run: ${action.command}`
        : `${action.message} — ${action.fix}`,
    });
  }

  tasks.push({
    id: "VERIFY",
    priority: priority++,
    task: "Verify: npx ai-spector docops check --json (expect valid: true, writerReady: true). Report written vs skipped paths.",
  });

  return tasks;
}

function buildAgentPrompt(result: Omit<DocopsMigrateGuideResult, "agentPrompt">): string {
  const lines: string[] = [
    "Docops migration — achieve the expected structure below. User asked to migrate; execute tasks without re-asking unless destructive.",
    "",
    `Layout: ${result.layout} | writerReady: ${result.writerReady} | recommended: ${result.recommendedAction}`,
    "",
    "── Current state (on disk now) ──",
    `- config: ${result.currentState.configExists ? result.currentState.configPath : "(missing)"}`,
    `- legacy paths: ${result.currentState.legacyPathsFound.join(", ") || "none"}`,
    `- doc roots: ${Object.entries(result.currentState.onDiskDocRoots).map(([k, p]) => `${k}=${p}`).join(", ") || "none detected"}`,
  ];

  if (result.currentState.missingScaffold.length > 0) {
    lines.push(`- missing scaffold (${result.currentState.missingScaffold.length}):`);
    for (const p of result.currentState.missingScaffold.slice(0, 10)) {
      lines.push(`  · ${p}`);
    }
    if (result.currentState.missingScaffold.length > 10) {
      lines.push(`  · ... and ${result.currentState.missingScaffold.length - 10} more`);
    }
  } else if (!result.writerReady) {
    lines.push("- missing scaffold: (run repair preview / gap-fill tasks below)");
  } else {
    lines.push("- scaffold: complete");
  }

  lines.push(
    "",
    "── Expected (target — merge config, gap-fill files; never overwrite existing) ──",
    `Automated CLI (try first): ${result.cli.primaryCommand}`,
    "",
  );

  if (result.cli.blockers.length > 0) {
    lines.push("Why CLI may fail:");
    for (const [i, b] of result.cli.blockers.entries()) {
      lines.push(`${i + 1}. ${b}`);
    }
    lines.push("");
  }

  lines.push("Target docTypes (correct paths — edit config to match; do not move docs unless user asks):");
  for (const [key, dt] of Object.entries(result.targetState.docTypes)) {
    if (!dt) continue;
    const tpl = dt.templatesPath ? ` templatesPath: ${dt.templatesPath}` : "";
    lines.push(`- ${key}: enabled=${String(dt.enabled)} path=${dt.path}${tpl}`);
  }

  const examples = result.targetState.examples;

  if (examples.wrongVsCorrect.length > 0) {
    lines.push("", "Wrong vs correct (this project):");
    for (const row of examples.wrongVsCorrect) {
      lines.push(`- ${row.field}: wrong ${row.wrong ?? "—"} → correct ${row.correct}`);
      lines.push(`  (${row.reason})`);
    }
  }

  lines.push(
    "",
    "Example .docops/docops.config.json for this repo (merge into existing file):",
    "```json",
    JSON.stringify(examples.docopsConfig, null, 2),
    "```",
  );

  if (examples.documentPaths.length > 0) {
    lines.push("", "Example document paths (should already exist on disk — do not move):");
    for (const p of examples.documentPaths) {
      lines.push(`- ${p}`);
    }
  }

  if (examples.scaffoldPaths.length > 0) {
    lines.push("", "Contract scaffold (gap-fill only — skip if path exists):");
    for (const p of examples.scaffoldPaths.slice(0, 12)) {
      lines.push(`- ${p}`);
    }
    if (examples.scaffoldPaths.length > 12) {
      lines.push(`- ... and ${examples.scaffoldPaths.length - 12} more`);
    }
  }

  if (examples.engineJson) {
    lines.push(
      "",
      "Example .ai-spector/engine.json (create if missing during upgrade):",
      "```json",
      JSON.stringify(examples.engineJson, null, 2),
      "```",
    );
  }

  lines.push(
    "",
    "Bundled in ai-spector CLI (standalone — no monorepo required):",
    `- bootstrap: ${examples.bundle.bootstrapRoot}`,
    `- contracts (schemas/examples): ${examples.bundle.contractsRoot}`,
    "",
    "Bootstrap gap-fill copy map (skip if destination exists):",
  );
  for (const row of examples.bootstrapCopyMap) {
    lines.push(`- ${row.source} → ${row.destination}`);
  }

  if (result.targetState.notes.length > 0) {
    lines.push("", "Rules:");
    for (const note of result.targetState.notes) {
      lines.push(`- ${note}`);
    }
  }

  if (result.layoutSuggestions.length > 0) {
    lines.push("", "Layout probe:");
    for (const s of result.layoutSuggestions) {
      lines.push(`- ${s}`);
    }
  }

  if (result.cli.repairPreview.length > 0) {
    lines.push("", "Repair preview (dry-run — safe to apply via CLI or manual gap-fill):");
    for (const line of result.cli.repairPreview.slice(0, 15)) {
      lines.push(`- ${line}`);
    }
    if (result.cli.repairPreview.length > 15) {
      lines.push(`- ... and ${result.cli.repairPreview.length - 15} more`);
    }
  }

  lines.push("", "Tasks (in order):");
  for (const task of result.agentTasks) {
    lines.push(`${task.priority}. [${task.id}] ${task.task}`);
  }

  lines.push(
    "",
    "Reference (read in repo):",
    ...result.referenceGuides.map((g) => `- ${g}`),
    "",
    "After changes: " + result.verifyCommands.join(" → "),
  );

  return lines.join("\n");
}

async function detectCliBlockers(
  projectRoot: string,
  assessment: DocopsAssessment,
): Promise<string[]> {
  const blockers: string[] = [];
  const hasDocops = await pathExists(join(projectRoot, DOCOPS_CONFIG_REL));
  const hasDocflow = await pathExists(join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL));

  if (assessment.recommendedAction === "migrate" && hasDocops) {
    blockers.push(
      `${DOCOPS_CONFIG_REL} already exists — use docops migrate --repair (not bare migrate) or docops guide for agent gap-fill.`,
    );
  }
  if (assessment.recommendedAction === "migrate" && !hasDocflow && !hasDocops) {
    blockers.push("No legacy docflow.config.json — use docops init instead of migrate.");
  }
  if (assessment.recommendedAction === "init" && hasDocops) {
    blockers.push(
      `${DOCOPS_CONFIG_REL} already exists — use docops migrate --repair or docops init --force (fills gaps only).`,
    );
  }
  if (hasDocops && hasDocflow && assessment.layout === "mixed") {
    blockers.push(
      "Mixed legacy + docops layout — automated migrate may skip existing files; agent must gap-fill per targetState.",
    );
  }

  return blockers;
}

export async function buildDocopsMigrateGuide(projectRoot: string): Promise<DocopsMigrateGuideResult> {
  const assessment = await assessDocopsProject(projectRoot);
  const check = await checkDocopsConfig(projectRoot);
  const layout = await probeDocopsLayout(projectRoot);
  const config = await readDocopsConfig(projectRoot);

  const repairDry = config
    ? await migrateDocopsLayout({ projectRoot, repair: true, dryRun: true })
    : { actions: [] as string[] };

  const repairPreview = repairDry.actions.filter((a) => !a.startsWith("skip"));
  const blockers = await detectCliBlockers(projectRoot, assessment);
  const primaryCommand = recommendedCliCommand(assessment.recommendedAction);
  const targetState = buildTargetState(assessment, layout, config, assessment.gaps);
  const currentState = await buildCurrentState(
    projectRoot,
    assessment,
    layout,
    check,
    targetState.examples.scaffoldPaths,
  );

  const partial: Omit<DocopsMigrateGuideResult, "agentPrompt"> = {
    generatedAt: new Date().toISOString(),
    layout: assessment.layout,
    writerReady: assessment.writerReady,
    recommendedAction: assessment.recommendedAction,
    currentState,
    cli: {
      primaryCommand,
      fallbackCommand: "npx ai-spector docops guide --prompt",
      autoRepairWouldRun: repairPreview.length > 0,
      blockers,
      repairPreview,
    },
    gaps: assessment.gaps,
    layoutSuggestions: layout.suggestions,
    targetState,
    agentTasks: [],
    verifyCommands: [
      "npx ai-spector docops check --json",
      "npx ai-spector docops status --json",
    ],
    referenceGuides: [
      ".docops/guide/guides/DOCOPS_MANUAL_FALLBACK.md",
      ".docops/guide/guides/PROJECT_LAYOUT.md",
      ".docops/guide/MIGRATION.md",
    ],
  };

  partial.agentTasks = buildAgentTasks(assessment, check, targetState, partial.cli);

  return {
    ...partial,
    agentPrompt: buildAgentPrompt(partial),
  };
}
