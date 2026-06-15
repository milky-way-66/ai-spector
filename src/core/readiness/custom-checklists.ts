import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { reviewChecklistsDir, reviewChecklistsDocTypeDir } from "../config/docflow-paths.js";
import { pathExists, readJson } from "../util/fs.js";
import type { ReadinessSeverity } from "./types.js";
import type { OutputChecklistItem } from "./output-checklist.js";

export interface CustomChecklistItemDef {
  id: string;
  severity: ReadinessSeverity;
  question: string;
  agentCheck?: string;
  iso29148?: string;
  dimension?: string;
  field?: string;
  heading?: string;
}

export interface CustomChecklistFile {
  version?: number;
  title?: string;
  description?: string;
  /** Optional path filters. Omit for _all/ files (always apply) or doc-specific filename rules. */
  match?: {
    logicalPaths?: string[];
    docPaths?: string[];
  };
  items: CustomChecklistItemDef[];
}

export interface CustomChecklistMatchContext {
  docType: string;
  docPath: string;
  logicalPath?: string;
}

interface ChecklistFileRef {
  absPath: string;
  scope: "all" | "doc-specific" | "pattern";
}

const ALL_FOLDER = "_all";
const GLOBAL_CHECKLIST_NAMES = new Set(["_all.json", "global.json"]);

/** Convert a simple glob pattern to RegExp (`*` within segment, `**` across `/`). */
export function matchPathPattern(pattern: string, value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  const glob = pattern.replace(/\\/g, "/");
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i]!;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
      continue;
    }
    if (".+?^${}()|[]\\".includes(ch)) {
      re += "\\" + ch;
    } else {
      re += ch;
    }
    i += 1;
  }
  re += "$";
  return new RegExp(re).test(normalized);
}

function matchesAnyPattern(patterns: string[] | undefined, value: string | undefined): boolean {
  if (!patterns?.length || !value) return false;
  return patterns.some((p) => matchPathPattern(p, value));
}

function docMatchesStem(stem: string, ctx: CustomChecklistMatchContext, docType: string): boolean {
  const lp = ctx.logicalPath?.replace(/\\/g, "/");
  if (lp) {
    if (lp === `${docType}/${stem}` || lp.endsWith(`/${stem}`)) return true;
  }
  return ctx.docPath.replace(/\\/g, "/").includes(`/${stem}.md`);
}

function fileAppliesToDocument(
  file: CustomChecklistFile,
  ref: ChecklistFileRef,
  docType: string,
  ctx: CustomChecklistMatchContext,
): boolean {
  const fileName = basename(ref.absPath);

  if (ref.scope === "all") return true;

  if (file.match || ref.scope === "pattern") {
    if (matchesAnyPattern(file.match?.logicalPaths, ctx.logicalPath)) return true;
    if (matchesAnyPattern(file.match?.docPaths, ctx.docPath)) return true;
    return false;
  }

  if (GLOBAL_CHECKLIST_NAMES.has(fileName)) return true;

  const stem = fileName.replace(/\.json$/i, "");
  return docMatchesStem(stem, ctx, docType);
}

function buildCustomAgentCheck(item: CustomChecklistItemDef): string {
  if (item.agentCheck?.trim()) return item.agentCheck.trim();
  const parts: string[] = [];
  if (item.heading) parts.push(`Section "${item.heading}"`);
  if (item.field) parts.push(`field ${item.field}`);
  parts.push(item.question);
  if (item.iso29148) parts.push(`(ISO 29148 §${item.iso29148})`);
  return parts.join(" — ");
}

function toOutputItem(
  item: CustomChecklistItemDef,
  meta: { checklistFile: string; checklistTitle?: string },
): OutputChecklistItem {
  return {
    criterionId: item.id,
    iso29148: item.iso29148,
    dimension: item.dimension,
    severity: item.severity,
    question: item.question,
    field: item.field,
    heading: item.heading,
    agentCheck: buildCustomAgentCheck(item),
    source: "custom",
    checklistFile: meta.checklistFile,
    checklistTitle: meta.checklistTitle,
  };
}

async function listJsonFiles(dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => join(dir, e.name).replace(/\\/g, "/"));
}

/** Skip sample/template files (prefix `_` except `_all.json`). */
function isActiveChecklistFile(fileName: string): boolean {
  if (GLOBAL_CHECKLIST_NAMES.has(fileName)) return true;
  return !basename(fileName).startsWith("_");
}

async function collectChecklistRefs(root: string, docType: string): Promise<ChecklistFileRef[]> {
  const refs: ChecklistFileRef[] = [];
  const docTypeDir = reviewChecklistsDocTypeDir(root, docType);
  const allDir = join(docTypeDir, ALL_FOLDER).replace(/\\/g, "/");

  for (const absPath of await listJsonFiles(allDir)) {
    if (!isActiveChecklistFile(basename(absPath))) continue;
    refs.push({ absPath, scope: "all" });
  }

  for (const absPath of await listJsonFiles(docTypeDir)) {
    const fileName = basename(absPath);
    if (!isActiveChecklistFile(fileName)) continue;
    refs.push({
      absPath,
      scope: GLOBAL_CHECKLIST_NAMES.has(fileName) ? "all" : "doc-specific",
    });
  }

  for (const absPath of await listJsonFiles(reviewChecklistsDir(root))) {
    const fileName = basename(absPath);
    if (!isActiveChecklistFile(fileName)) continue;
    refs.push({ absPath, scope: "pattern" });
  }

  return refs;
}

export async function loadCustomChecklistItems(
  root: string,
  ctx: CustomChecklistMatchContext,
): Promise<{ items: OutputChecklistItem[]; files: string[] }> {
  const items: OutputChecklistItem[] = [];
  const files: string[] = [];
  const seenIds = new Set<string>();

  for (const ref of await collectChecklistRefs(root, ctx.docType)) {
    const fileName = basename(ref.absPath);
    let parsed: CustomChecklistFile;
    try {
      parsed = await readJson<CustomChecklistFile>(ref.absPath);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) continue;

    const relFile = ref.absPath.replace(root.endsWith("/") ? root : root + "/", "");

    if (ref.scope === "pattern" && !parsed.match) continue;

    if (!fileAppliesToDocument(parsed, ref, ctx.docType, ctx)) continue;

    files.push(relFile);
    for (const item of parsed.items) {
      if (!item.id || !item.question || !item.severity) continue;
      const dedupeKey = `${relFile}::${item.id}`;
      if (seenIds.has(dedupeKey)) continue;
      seenIds.add(dedupeKey);
      items.push(
        toOutputItem(item, {
          checklistFile: relFile,
          checklistTitle: parsed.title,
        }),
      );
    }
  }

  return { items, files };
}
