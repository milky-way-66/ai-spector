import { createRequire } from "node:module";
import type { TraceabilityGraph, ValidationIssue } from "@/types.js";

const require = createRequire(import.meta.url);
const Ajv = require("ajv/dist/2020.js") as typeof import("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats") as typeof import("ajv-formats").default;
import type { SectionRegistry } from "@/types.js";
import { InMemoryGraph } from "../graph/InMemoryGraph.js";
import { readJson } from "../util/fs.js";

export interface ValidateOptions {
  graphPath: string;
  schemaPath: string;
  registryPath?: string;
  rulesPath?: string;
}

export async function validateGraph(
  opts: ValidateOptions,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const graph = await readJson<TraceabilityGraph>(opts.graphPath);
  const schema = await readJson<Record<string, unknown>>(opts.schemaPath);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(graph)) {
    for (const err of validate.errors ?? []) {
      issues.push({
        ruleId: "SCHEMA",
        severity: "error",
        message: `${err.instancePath || "/"} ${err.message}`,
      });
    }
  }

  let mem: InMemoryGraph;
  try {
    mem = InMemoryGraph.from(graph);
  } catch (e) {
    issues.push({
      ruleId: "GRAPH-LOAD",
      severity: "error",
      message: e instanceof Error ? e.message : String(e),
    });
    return issues;
  }

  issues.push(...mem.validateStructure());

  if (opts.registryPath) {
    const registry = await readJson<SectionRegistry>(opts.registryPath);
    const graphSectionIds = new Set(
      [...mem.nodesById.values()]
        .filter((n) => n.type === "section")
        .map((n) => n.id),
    );
    for (const doc of registry.documents) {
      for (const sec of doc.sections) {
        if (!graphSectionIds.has(sec.id)) {
          issues.push({
            ruleId: "REGISTRY-COMPLETE",
            severity: "error",
            message: `Registry section missing from graph: ${sec.id} (${doc.documentId})`,
            nodeId: sec.id,
          });
        }
      }
      if (!mem.nodesById.has(doc.documentId)) {
        issues.push({
          ruleId: "REGISTRY-COMPLETE",
          severity: "error",
          message: `Registry document missing from graph: ${doc.documentId}`,
          nodeId: doc.documentId,
        });
      }
    }
  }

  if (opts.rulesPath) {
    const rules = await readJson<{ rules?: { id: string; severity: string; description: string }[] }>(
      opts.rulesPath,
    );
    for (const r of rules.rules ?? []) {
      if (r.id === "REGISTRY-COMPLETE" && !opts.registryPath) {
        issues.push({
          ruleId: r.id,
          severity: "warn",
          message: `Rule ${r.id} skipped: no registry path provided`,
        });
      }
    }
  }

  return issues;
}

export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "OK — no validation issues";
  }
  const lines = issues.map(
    (i) =>
      `[${i.severity.toUpperCase()}] ${i.ruleId}: ${i.message}${i.nodeId ? ` (${i.nodeId})` : ""}`,
  );
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    lines.push("");
    lines.push(
      "Fix each ERROR above, then re-run: npx ai-spector graph validate (or /validate-graph in Cursor).",
    );
    lines.push(
      "Do not generate docs until validate passes (or user approves a workaround). See .cursor/skills/ai-spector/references/cli-failures.md",
    );
  }
  return lines.join("\n");
}
