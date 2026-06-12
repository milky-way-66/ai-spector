import { basename, join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson } from "../util/fs.js";
import { loadMergedReadinessCriteria } from "./resolve.js";
import type { ReadinessCriterion, ReadinessCriteriaFile } from "./types.js";

export interface DagNodeDef {
  id: string;
  template?: string;
  output?: string;
  mode?: string;
}

export interface DagFile {
  version?: number;
  root?: string;
  nodes?: DagNodeDef[];
}

export interface OutputChecklistItem {
  criterionId: string;
  iso29148?: string;
  dimension?: string;
  severity: string;
  question: string;
  field?: string;
  heading?: string;
  /** Prompt for the agent — verify this in the written file body (semantic judgment). */
  agentCheck: string;
}

export interface OutputChecklistForPath {
  path: string;
  dagNode: string | null;
  template?: string;
  iso29148Sections: string[];
  items: OutputChecklistItem[];
}

export interface ReadinessOutputChecklistResult {
  docType: string;
  profile: string;
  criteriaPath: string;
  agentRole: string;
  workflow: string[];
  checklists: OutputChecklistForPath[];
}

const AGENT_ROLE =
  "You perform semantic output compliance — read each file body and score every checklist item " +
  "met | partial | missing. Code tools supply structure (readiness_scan) and this rubric only; " +
  "do not expect an automated semantic engine.";

const WORKFLOW_STEPS = [
  "1. readiness_scan({ paths }) — structural checks (headings, placeholders, empty sections)",
  "2. readiness_output_checklist({ paths }) — rubric per file (this tool)",
  "3. Read each path from disk; for each item, judge met/partial/missing with evidence quotes",
  "4. Present Output compliance table to the user before task_record_wave",
  "5. On partial/missing blocking items: fix in place, or context_record assumption + user accept",
];

function normalizeRelPath(root: string, p: string): string {
  const n = p.replace(/\\/g, "/");
  if (n.startsWith(root + "/")) return n.slice(root.length + 1);
  return n.replace(/^\.\//, "");
}

function dagFileName(docType: string, packName: string | null): string {
  if (docType === "srs") return "dag.srs.json";
  if (docType === "basic-design") return "dag.basic-design.json";
  if (packName) return `dag.${packName}.json`;
  return `dag.${docType}.json`;
}

async function loadDag(root: string, docType: string, packName: string | null): Promise<DagFile | null> {
  const configDir = join(root, ".ai-spector/.docflow/config");
  const name = dagFileName(docType, packName);
  const path = join(configDir, name);
  if (!(await pathExists(path))) return null;
  return readJson<DagFile>(path);
}

export function resolveDagNodeForPath(relPath: string, dag: DagFile | null): DagNodeDef | null {
  if (!dag?.nodes?.length) return null;
  const n = relPath.replace(/\\/g, "/");
  const fileName = basename(n);
  const parentDir = n.includes("/") ? n.slice(0, n.lastIndexOf("/") + 1) : "";

  let best: DagNodeDef | null = null;
  let bestLen = -1;

  for (const node of dag.nodes) {
    const out = node.output?.replace(/\\/g, "/");
    if (!out) continue;

    if (out.endsWith("/")) {
      if (parentDir.endsWith(out) || n.includes(`/${out}`)) {
        if (out.length > bestLen) {
          best = node;
          bestLen = out.length;
        }
      }
      continue;
    }

    if (fileName === out || n.endsWith(`/${out}`)) {
      if (out.length > bestLen) {
        best = node;
        bestLen = out.length;
      }
    }
  }

  return best;
}

function isoSectionsForTemplate(
  criteria: ReadinessCriteriaFile,
  template: string | undefined,
  fileName: string,
): string[] {
  const map = criteria.templateToIso29148;
  if (!map) return [];

  const templateBase = template ? basename(template) : fileName;
  if (map[templateBase]) return map[templateBase]!;

  for (const [pattern, refs] of Object.entries(map)) {
    if (pattern.includes("*")) {
      const re = new RegExp(
        "^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*") + "$",
      );
      if (re.test(fileName) || re.test(templateBase)) return refs;
    }
  }
  return [];
}

function buildAgentCheck(c: ReadinessCriterion): string {
  const parts: string[] = [];
  if (c.heading) parts.push(`Section "${c.heading}"`);
  if (c.field) parts.push(`field ${c.field}`);
  parts.push(c.question);
  if (c.iso29148) parts.push(`(ISO 29148 §${c.iso29148})`);
  return parts.join(" — ");
}

function criteriaForDagNode(
  criteria: ReadinessCriteriaFile,
  dagNodeId: string,
): ReadinessCriterion[] {
  const target = criteria.targets?.find((t) => t.dagNode === dagNodeId);
  const items: ReadinessCriterion[] = [...(target?.criteria ?? [])];

  const isDetail =
    /feature-details|use-case-detail|detail-api|detail-screen|perFeature|perEndpoint|perScreen/i.test(
      dagNodeId,
    ) || /features\/|UC-|api\/|screens\//i.test(dagNodeId);

  if (isDetail && criteria.requirementQuality) {
    const rq = criteria.requirementQuality as {
      individualCharacteristics?: Array<{ id?: string; name?: string; check?: string; iso?: string }>;
    };
    for (const ch of rq.individualCharacteristics ?? []) {
      if (!ch.id || !ch.check) continue;
      items.push({
        id: ch.id,
        severity: "should-ask",
        question: ch.check,
        iso29148: ch.iso,
        dimension: "requirement-quality",
      });
    }
  }

  return items;
}

export interface BuildOutputChecklistOptions {
  root?: string;
  docType?: string;
  profile?: string;
  paths: string[];
}

export async function buildReadinessOutputChecklist(
  opts: BuildOutputChecklistOptions,
): Promise<ReadinessOutputChecklistResult> {
  const { root, config } = await loadDocflowConfig(opts.root);
  const merged = await loadMergedReadinessCriteria({
    root,
    docType: opts.docType,
    profile: opts.profile,
  });
  const dag = await loadDag(root, merged.docType, merged.packName);
  const checklists: OutputChecklistForPath[] = [];

  for (const rawPath of opts.paths) {
    const relPath = normalizeRelPath(root, rawPath);
    const dagNode = resolveDagNodeForPath(relPath, dag);
    const fileName = basename(relPath);
    const criterionList = dagNode ? criteriaForDagNode(merged.criteria, dagNode.id) : [];

    const items: OutputChecklistItem[] = criterionList.map((c) => ({
      criterionId: c.id,
      iso29148: c.iso29148,
      dimension: c.dimension,
      severity: c.severity,
      question: c.question,
      field: c.field,
      heading: c.heading,
      agentCheck: buildAgentCheck(c),
    }));

    checklists.push({
      path: relPath,
      dagNode: dagNode?.id ?? null,
      template: dagNode?.template,
      iso29148Sections: isoSectionsForTemplate(merged.criteria, dagNode?.template, fileName),
      items,
    });
  }

  return {
    docType: merged.docType,
    profile: merged.profileId,
    criteriaPath: merged.criteriaPath,
    agentRole: AGENT_ROLE,
    workflow: WORKFLOW_STEPS,
    checklists,
  };
}
