import { join } from "node:path";
import type { PackManifest, ManifestDocument } from "../config/types.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { ScanFile, ScanResult } from "./scan.js";

// ---------------------------------------------------------------------------
// Pack install completeness — agent + user must finish before first generate
// ---------------------------------------------------------------------------

export interface PackSetupItem {
  id: string;
  phase: "import" | "agent" | "user" | "verify";
  label: string;
  required: boolean;
  done: boolean;
  detail?: string;
  blocker?: boolean;
}

export interface PackSetupState {
  version: 1;
  packName: string;
  status: "incomplete" | "ready";
  createdAt: string;
  completedAt: string | null;
  items: PackSetupItem[];
}

function scanFileForDoc(scanResult: ScanResult | undefined, template: string): ScanFile | undefined {
  if (!scanResult) return undefined;
  return scanResult.files.find((f) => f.relativePath === template || f.relativePath.endsWith(`/${template}`));
}

function countContextMapTodos(contextMap: { placeholders?: Record<string, { source: string }> }): number {
  return Object.values(contextMap.placeholders ?? {}).filter((e) => e.source === "TODO").length;
}

/** Build pack-setup.json — tracks install completion with agent/user checklist. */
export function buildPackSetupState(
  manifest: PackManifest,
  scanResult: ScanResult | undefined,
  contextMap: { placeholders?: Record<string, { source: string }> },
  opts?: { skillIncludesGatedFlow?: boolean },
): PackSetupState {
  const todoCount = countContextMapTodos(contextMap);
  const hasPerDomain = manifest.documents.some((d) => d.perDomain);
  const hasLangInOutput = manifest.documents.some((d) =>
    (d.output ?? d.outputPattern ?? "").includes("{lang}"),
  );

  const items: PackSetupItem[] = [
    {
      id: "manifest.purpose",
      phase: "import",
      label: "Purpose documented in manifest.json",
      required: true,
      done: Boolean(manifest.purpose?.trim()),
      detail: manifest.purpose ?? "Set purpose (SRS, arc42, ADR, …)",
    },
    {
      id: "manifest.standards",
      phase: "import",
      label: "Standards alignment recorded",
      required: true,
      done: Boolean(manifest.standards?.length),
      detail: "e.g. ISO-29148, arc42",
    },
    {
      id: "manifest.docType",
      phase: "import",
      label: "Context store docType set",
      required: true,
      done: Boolean(manifest.docType?.trim() || manifest.packName),
      detail: `docType: ${manifest.docType ?? manifest.packName}`,
    },
    {
      id: "manifest.outputs",
      phase: "import",
      label: "All documents have output paths",
      required: true,
      done: manifest.documents.every((d) => d.output || d.outputPattern),
    },
    {
      id: "context-map.resolved",
      phase: "agent",
      label: "All context-map.json placeholders mapped (no TODO)",
      required: true,
      done: todoCount === 0,
      detail: todoCount > 0 ? `${todoCount} TODO placeholder(s) remain` : "All placeholders mapped",
      blocker: todoCount > 0,
    },
    {
      id: "readiness.reviewed",
      phase: "user",
      label: "User reviewed readiness-criteria.json",
      required: true,
      done: false,
      detail: "Confirm blocking criteria and severity for your domain",
    },
    {
      id: "readiness.domain",
      phase: "agent",
      label: "Domain-specific criteria added or adjusted",
      required: false,
      done: false,
      detail: "Add criteria beyond auto-generated headings if needed",
    },
    {
      id: "skill.gated-flow",
      phase: "agent",
      label: "Generate skill includes task gate + clarify flow",
      required: true,
      done: opts?.skillIncludesGatedFlow ?? false,
      detail: "Step 0 task_list, readiness, briefing, plan",
    },
    {
      id: "languages.strategy",
      phase: "user",
      label: "Multi-language output strategy confirmed",
      required: hasLangInOutput,
      done: !hasLangInOutput,
      detail: hasLangInOutput
        ? "docflow.config.json languages must match {lang} in outputs"
        : "Single-language pack — N/A",
    },
    {
      id: "graph.prerequisites",
      phase: "user",
      label: "Data-source analyzed / graph has domain nodes for generation",
      required: true,
      done: false,
      detail: hasPerDomain
        ? `Graph must contain ${[...new Set(manifest.documents.filter((d) => d.perDomain).map((d) => d.perDomain))].join(", ")} nodes`
        : "Run analyze + index before first generate",
    },
    {
      id: "pack-context.reviewed",
      phase: "agent",
      label: "pack-context/*.md graph probes reviewed",
      required: false,
      done: false,
      detail: "Per-document generation hints for agents",
    },
    {
      id: "verify.inspect",
      phase: "verify",
      label: "template inspect shows ready status",
      required: true,
      done: false,
      detail: "npx ai-spector template inspect <pack> --json",
    },
  ];

  const blocking = items.filter((i) => i.required && !i.done);
  return {
    version: 1,
    packName: manifest.packName,
    status: blocking.length === 0 ? "ready" : "incomplete",
    createdAt: new Date().toISOString(),
    completedAt: blocking.length === 0 ? new Date().toISOString() : null,
    items,
  };
}

export function isPackSetupReady(state: PackSetupState): boolean {
  return state.items.filter((i) => i.required && !i.done).length === 0;
}

/** Human-readable install checklist for agent walkthrough. */
export function buildInstallChecklistMarkdown(
  manifest: PackManifest,
  setup: PackSetupState,
  contextMapTodoCount: number,
): string {
  const lines = [
    `# Install checklist — ${manifest.packName}`,
    "",
    `> Complete with the user before the first generate run. Status: **${setup.status}**`,
    "",
    "## Agent + user phases",
    "",
    "| Phase | Who | Action |",
    "|-------|-----|--------|",
    "| Import | User | Answer purpose, standards, output paths, vocabulary |",
    "| Import | Agent | Draft manifest, refine templates, write generate skill |",
    "| Post-install | Agent | Resolve context-map TODOs with user |",
    "| Post-install | User | Review readiness-criteria.json — adjust blocking items |",
    "| Post-install | User | Confirm languages / graph prerequisites |",
    "| Verify | Agent | Mark items done in pack-setup.json → status ready |",
    "",
    "## Checklist items",
    "",
  ];

  for (const item of setup.items) {
    const mark = item.done ? "x" : " ";
    const req = item.required ? "**required**" : "optional";
    lines.push(`- [${mark}] (${item.phase}, ${req}) ${item.label}`);
    if (item.detail) lines.push(`  - ${item.detail}`);
  }

  lines.push(
    "",
    "## Context-map TODOs",
    "",
    contextMapTodoCount === 0
      ? "None — all placeholders mapped."
      : `**${contextMapTodoCount}** placeholder(s) still marked TODO in context-map.json.`,
    "",
    "## When status = ready",
    "",
    "Update `pack-setup.json`: set each completed item `done: true`, then `status: \"ready\"`.",
    "",
    "```bash",
    `npx ai-spector template inspect ${manifest.packName} --json`,
    "```",
    "",
  );

  return lines.join("\n");
}

/** Per-document context guides (like builtin srs-context/*.md). */
export function buildPackContextGuide(doc: ManifestDocument, scanFile?: ScanFile): string {
  const output = doc.output ?? doc.outputPattern ?? "(see manifest)";
  const lines = [
    `# Graph → ${doc.template}`,
    "",
    `| Field | Graph / source |`,
    `|-------|----------------|`,
    `| **documentId** | \`${doc.documentId}\` |`,
    `| **output** | \`${output}\` |`,
  ];

  if (doc.perDomain) {
    lines.push(`| **perDomain** | \`${doc.perDomain}\` — one file per graph node |`);
    lines.push(
      "",
      `Query each item: \`graph query <${doc.perDomain}Id> --direction both --depth 4 --edges CONTEXT --json\``,
    );
  } else {
    lines.push(
      "",
      `Query seed: \`graph query ${doc.documentId} --direction both --depth 3 --json\``,
    );
  }

  if (scanFile?.headings.length) {
    lines.push("", "## Template sections", "", "| Section | Suggested graph source |", "|---------|------------------------|");
    for (const h of scanFile.headings.filter((x) => x.depth >= 2 && x.depth <= 4)) {
      lines.push(`| ${h.text} | Context from seed + linked ${doc.perDomain ?? "domain"} nodes |`);
    }
  }

  if (scanFile?.placeholders.length) {
    lines.push("", "## Placeholders", "");
    for (const p of scanFile.placeholders) {
      lines.push(`- ${p} — see context-map.json`);
    }
  }

  lines.push(
    "",
    "**Rule:** Do not invent content — use graph + context store answers + data-source.",
    "",
  );

  return lines.join("\n");
}

export function emptyContextStore(docType: string): object {
  return { version: 1, docType, entries: [] };
}

export function emptyGenStatus(packName: string): object {
  return { packName, updatedAt: null, items: [] };
}

export interface PackInspectSummary {
  packName: string;
  documentCount: number;
  breakoutDomains: string[];
  contextMapTodos: number;
  setupStatus: "incomplete" | "ready";
  setupBlockers: string[];
  readinessCriteriaCount: number;
  artifacts: Record<string, boolean>;
}

export async function markPackSetupItem(
  root: string,
  packName: string,
  itemId: string,
): Promise<{
  pack: string;
  itemId: string;
  status: PackSetupState["status"];
  remainingRequired: string[];
}> {
  const setupPath = join(root, ".ai-spector", "packs", packName, "pack-setup.json");
  if (!(await pathExists(setupPath))) {
    throw new Error(`No pack-setup.json for pack "${packName}"`);
  }
  const setup = await readJson<PackSetupState>(setupPath);
  const item = setup.items.find((i) => i.id === itemId);
  if (!item) {
    throw new Error(
      `Unknown item "${itemId}". Valid: ${setup.items.map((i) => i.id).join(", ")}`,
    );
  }
  item.done = true;
  const blocking = setup.items.filter((i) => i.required && !i.done);
  setup.status = blocking.length === 0 ? "ready" : "incomplete";
  setup.completedAt = blocking.length === 0 ? new Date().toISOString() : null;
  await writeJson(setupPath, setup);
  return {
    pack: packName,
    itemId,
    status: setup.status,
    remainingRequired: blocking.map((i) => i.id),
  };
}

export function summarizePackInspect(opts: {
  manifest: PackManifest;
  contextMapTodos: number;
  setup?: PackSetupState | null;
  readinessTargetCount?: number;
  artifacts: Record<string, boolean>;
}): PackInspectSummary {
  const blockers =
    opts.setup?.items.filter((i) => i.required && !i.done).map((i) => i.id) ?? [];
  return {
    packName: opts.manifest.packName,
    documentCount: opts.manifest.documents.length,
    breakoutDomains: [
      ...new Set(opts.manifest.documents.filter((d) => d.perDomain).map((d) => d.perDomain!)),
    ],
    contextMapTodos: opts.contextMapTodos,
    setupStatus: opts.setup?.status ?? "incomplete",
    setupBlockers: blockers,
    readinessCriteriaCount: opts.readinessTargetCount ?? 0,
    artifacts: opts.artifacts,
  };
}
