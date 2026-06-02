import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalysisKnowledge } from "./knowledge.js";
import { isKnowledgePayload, knowledgeHasDomainEntries } from "./knowledge.js";
import { mergePatch } from "./merge.js";
import { loadInMemoryGraph } from "./loadGraph.js";
import type { ExtractPatch } from "./knowledge.js";
import type { GraphEdge } from "../types.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { discoverMarkdownFiles } from "../index/docs-build.js";
import { indexDocsConfigPath, type IndexDocsConfig } from "../index/docs-config.js";
import { extractSourceRefsFromMarkdown } from "./source-refs.js";
import {
  knownSourceFileNodeIds,
  provenanceTargetId,
} from "./bundles.js";

export interface ProvenanceLinkOptions {
  projectRoot: string;
  graphPath: string;
  dataSourceRoot?: string;
  knowledgePath?: string;
}

export interface ProvenanceLinkResult {
  merged: boolean;
  detail: string;
  edgesAdded: number;
  domainNodesLinked: number;
}

function collectKnowledgeRefs(
  item: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  const fields = [
    "derivedFrom",
    "sourceRef",
    "sourceRefs",
    "sources",
    "sourceFiles",
    "source",
  ];
  for (const key of fields) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) {
      out.push(v.trim());
    } else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === "string" && x.trim()) {
          out.push(x.trim());
        }
      }
    }
  }
  return out;
}

/** Normalize to repo-relative path under docs/data-source when possible. */
export function normalizeDataSourcePath(
  ref: string,
  dataSourceRoot: string,
): string | undefined {
  let s = ref
    .trim()
    .replace(/^[`'"]+|[`'"]+$/g, "")
    .replace(/\\/g, "/");
  if (s.includes("§")) {
    s = s.split(/\s*§/)[0]!.trim();
  }
  if (!s || s.includes("://")) {
    return undefined;
  }
  const root = dataSourceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (s.startsWith(root + "/")) {
    return s;
  }
  if (s.startsWith("docs/data-source/")) {
    return s.replace(/\/+/g, "/");
  }
  if (!s.includes("/") && /\.[a-z0-9]{1,8}$/i.test(s)) {
    return `${root}/${s}`;
  }
  if (!s.startsWith("docs/") && !s.startsWith("/")) {
    const candidate = `${root}/${s.replace(/^\.\//, "")}`;
    if (candidate.startsWith(root)) {
      return candidate;
    }
  }
  return undefined;
}

function domainIdFromDetailContent(
  content: string,
  kind: "useCase" | "feature",
): string | null {
  if (kind === "useCase") {
    const m = content.match(/\*\*Use Case ID:\*\*\s*(UC-\d+)/i);
    return m?.[1] ? m[1].replace(/(UC-)(\d+)/i, (_, p, n) => `${p}${n.padStart(2, "0")}`) : null;
  }
  const m = content.match(/\*\*Feature ID:\*\*\s*(F-\d+)/i);
  return m?.[1] ? m[1].replace(/(F-)(\d+)/i, (_, p, n) => `${p}${n.padStart(2, "0")}`) : null;
}

function buildProvenancePatch(
  domainRefs: Map<string, Set<string>>,
  dataSourceRoot: string,
  validDomainIds: Set<string>,
  knownSourceFiles: ReadonlySet<string>,
): ExtractPatch {
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const [domainId, refs] of domainRefs) {
    if (!validDomainIds.has(domainId)) {
      continue;
    }
    for (const ref of refs) {
      const normalized = normalizeDataSourcePath(ref, dataSourceRoot);
      if (!normalized) {
        continue;
      }
      const to = provenanceTargetId(normalized, knownSourceFiles);
      const key = `${domainId}|derivedFrom|${to}`;
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push({ type: "derivedFrom", from: domainId, to });
    }
  }

  return { version: 1, nodes: [], edges };
}

export async function collectDomainProvenanceRefs(
  opts: ProvenanceLinkOptions & { dataSourceRoot: string },
): Promise<Map<string, Set<string>>> {
  const domainRefs = new Map<string, Set<string>>();
  const addRef = (domainId: string, ref: string) => {
    if (!domainId || !ref.trim()) {
      return;
    }
    const set = domainRefs.get(domainId) ?? new Set<string>();
    set.add(ref.trim());
    domainRefs.set(domainId, set);
  };

  const knowledgePath =
    opts.knowledgePath ??
    join(opts.projectRoot, ".ai-spector/.docflow/analysis/knowledge.json");
  if (await pathExists(knowledgePath)) {
    const raw = await readJson<unknown>(knowledgePath);
    if (isKnowledgePayload(raw) && knowledgeHasDomainEntries(raw as AnalysisKnowledge)) {
      const k = raw as AnalysisKnowledge;
      const lists: Array<{ items?: Array<Record<string, unknown>> }> = [
        { items: k.useCases as Array<Record<string, unknown>> | undefined },
        { items: k.features as Array<Record<string, unknown>> | undefined },
        { items: k.actors as Array<Record<string, unknown>> | undefined },
        { items: k.functionalRequirements as Array<Record<string, unknown>> | undefined },
        { items: k.nfrs as Array<Record<string, unknown>> | undefined },
        { items: k.entities as Array<Record<string, unknown>> | undefined },
      ];
      for (const { items } of lists) {
        for (const item of items ?? []) {
          const id = String(item.id ?? "");
          for (const ref of collectKnowledgeRefs(item)) {
            addRef(id, ref);
          }
        }
      }
    }
  }

  const configPath = indexDocsConfigPath(opts.projectRoot);
  if (await pathExists(configPath)) {
    const config = await readJson<IndexDocsConfig>(configPath);
    const entries: Array<{ relativePath: string; content: string }> = [];
    for (const key of ["srs", "basicDesign"] as const) {
      const source = config.sources[key];
      if (!source?.root) {
        continue;
      }
      const files = await discoverMarkdownFiles(
        opts.projectRoot,
        source.root,
        source.glob ?? "**/*.md",
      );
      for (const f of files) {
        const content = await readFile(
          join(opts.projectRoot, f.relativePath),
          "utf8",
        );
        entries.push({ relativePath: f.relativePath, content });
      }
    }

    for (const e of entries) {
      const refs = extractSourceRefsFromMarkdown(e.content);
      if (refs.length === 0) {
        continue;
      }
      let domainId: string | null = null;
      if (/\/03-use-cases\//i.test(e.relativePath) || /\/uc-\d+/i.test(e.relativePath)) {
        domainId = domainIdFromDetailContent(e.content, "useCase");
      } else if (/\/04-system-features\/f-\d+/i.test(e.relativePath)) {
        domainId = domainIdFromDetailContent(e.content, "feature");
      }
      if (!domainId) {
        continue;
      }
      for (const ref of refs) {
        addRef(domainId, ref);
      }
    }
  }

  return domainRefs;
}

export async function runProvenanceLink(
  opts: ProvenanceLinkOptions,
): Promise<ProvenanceLinkResult> {
  const dataSourceRoot = opts.dataSourceRoot ?? "docs/data-source";

  const domainRefs = await collectDomainProvenanceRefs({
    ...opts,
    dataSourceRoot,
  });

  const graph = await loadInMemoryGraph(opts.graphPath);
  const validDomainIds = new Set(
    [...graph.nodesById.values()]
      .filter((n) =>
        ["actor", "useCase", "feature", "requirement", "dataEntity"].includes(
          n.type,
        ),
      )
      .map((n) => n.id),
  );

  const knownSourceFiles = knownSourceFileNodeIds(graph);
  const patch = buildProvenancePatch(
    domainRefs,
    dataSourceRoot,
    validDomainIds,
    knownSourceFiles,
  );
  if (patch.edges.length === 0) {
    return {
      merged: false,
      detail: "No provenance evidence found (derivedFrom not added)",
      edgesAdded: 0,
      domainNodesLinked: 0,
    };
  }

  const linkedDomains = new Set(patch.edges.map((e) => e.from));
  const { stats } = mergePatch(graph, patch);
  await writeJson(opts.graphPath, graph.toTraceabilityGraph());

  const existing = [...linkedDomains].filter((id) => graph.nodesById.has(id));
  return {
    merged: true,
    detail: `linked ${existing.length} domain node(s), +${stats.edgesAdded} derivedFrom edge(s)`,
    edgesAdded: stats.edgesAdded,
    domainNodesLinked: existing.length,
  };
}
