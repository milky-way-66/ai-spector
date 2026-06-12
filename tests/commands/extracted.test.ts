import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runSpecList,
  runSpecRecord,
  runSpecApprove,
  runSpecReject,
} from "@/core/operations/extracted.js";
import { pathExists, readJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";
import type { TraceabilityGraph } from "@/types.js";
import type { ExtractPatch } from "@/core/graph/knowledge.js";

const GRAPH_PATH = ".ai-spector/graph/traceability.graph.json";

async function scaffold(root: string, withGraph = false): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({
      version: 1,
      languages: [{ code: "en", label: "English" }],
      paths: { graph: GRAPH_PATH },
    }),
    "utf8",
  );
  if (withGraph) {
    await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
    // Pre-seed the document the specs anchor to — in the real flow it exists
    // already (generated + indexed) before extraction runs.
    const graph: TraceabilityGraph = {
      version: 1,
      nodes: [
        { id: "doc.srs.quality", type: "document", title: "Quality Attributes" },
        { id: "doc.srs.quality.s1", type: "section", heading: "Overview", level: 2 },
      ],
      edges: [
        { type: "partOf", from: "doc.srs.quality.s1", to: "doc.srs.quality" },
        { type: "contains", from: "doc.srs.quality", to: "doc.srs.quality.s1" },
      ],
    };
    await writeFile(join(root, GRAPH_PATH), JSON.stringify(graph), "utf8");
    await mkdir(join(root, ".ai-spector/registry"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/registry/section-registry.json"),
      JSON.stringify({ version: 1, documents: [] }),
      "utf8",
    );
  }
}

// Realistic spec patch: the domain node anchors to an existing document
// (graph structure rules reject unanchored domain nodes and empty documents).
const SAMPLE_PATCH: ExtractPatch = {
  version: 1,
  nodes: [{ id: "nfr.payment-retry", type: "nfr", title: "Payment retry policy" }],
  edges: [{ type: "definedIn", from: "nfr.payment-retry", to: "doc.srs.quality" }],
};

describe("extracted-spec review queue", () => {
  it("records specs as pending with sequential ids", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const result = await runSpecRecord({
        root,
        docType: "srs",
        specs: [
          { statement: "Payments retry max 3 times", extractedFrom: ["docs/srs/en/07-quality.md"] },
          { statement: "Guest checkout allowed", extractedFrom: ["docs/srs/en/03-use-cases.md"] },
        ],
      });
      expect(result.recorded.map((s) => s.id)).toEqual(["SPEC-001", "SPEC-002"]);
      expect(result.recorded.every((s) => s.status === "pending")).toBe(true);
    });
  });

  it("approve merges the spec's graph patch into the graph", async () => {
    await withTempDir(async (root) => {
      await scaffold(root, true);
      await runSpecRecord({
        root,
        docType: "srs",
        specs: [
          {
            statement: "Payment retry policy is an NFR",
            extractedFrom: ["docs/srs/en/07-quality.md"],
            patch: SAMPLE_PATCH,
          },
        ],
      });
      const result = await runSpecApprove({ root, docType: "srs", id: "SPEC-001", by: "khang" });
      expect(result.spec.status).toBe("approved");
      expect(result.spec.reviewedBy).toBe("khang");
      expect(result.merge).toBeDefined();
      expect(result.merge!.stats.nodesCreated).toBe(1);

      const graph = await readJson<TraceabilityGraph>(join(root, GRAPH_PATH));
      expect(graph.nodes.some((n) => n.id === "nfr.payment-retry")).toBe(true);

      // audit patch file written beside the store
      expect(
        await pathExists(join(root, ".ai-spector/.docflow/extracted/srs.SPEC-001.patch.json")),
      ).toBe(true);
    });
  });

  it("approve without patch does not touch the graph", async () => {
    await withTempDir(async (root) => {
      await scaffold(root, true);
      await runSpecRecord({
        root,
        docType: "srs",
        specs: [{ statement: "Informational only", extractedFrom: [] }],
      });
      const result = await runSpecApprove({ root, docType: "srs", id: "SPEC-001" });
      expect(result.spec.status).toBe("approved");
      expect(result.merge).toBeUndefined();
      const graph = await readJson<TraceabilityGraph>(join(root, GRAPH_PATH));
      expect(graph.nodes.some((n) => n.type === "nfr")).toBe(false);
    });
  });

  it("rejected specs are kept for audit and never merged", async () => {
    await withTempDir(async (root) => {
      await scaffold(root, true);
      await runSpecRecord({
        root,
        docType: "srs",
        specs: [{ statement: "Bad idea", extractedFrom: [], patch: SAMPLE_PATCH }],
      });
      const result = await runSpecReject({ root, docType: "srs", id: "SPEC-001", note: "wrong" });
      expect(result.spec.status).toBe("rejected");
      expect(result.spec.note).toBe("wrong");
      const graph = await readJson<TraceabilityGraph>(join(root, GRAPH_PATH));
      expect(graph.nodes.some((n) => n.id === "nfr.payment-retry")).toBe(false);

      const list = await runSpecList({ root, docType: "srs", status: "rejected" });
      expect(list.total).toBe(1);
    });
  });

  it("re-approving an approved spec throws", async () => {
    await withTempDir(async (root) => {
      await scaffold(root, true);
      await runSpecRecord({ root, docType: "srs", specs: [{ statement: "x", extractedFrom: [] }] });
      await runSpecApprove({ root, docType: "srs", id: "SPEC-001" });
      await expect(runSpecApprove({ root, docType: "srs", id: "SPEC-001" })).rejects.toThrow(
        /already approved/,
      );
    });
  });

  it("never writes into docs/data-source/", async () => {
    await withTempDir(async (root) => {
      await scaffold(root, true);
      await mkdir(join(root, "docs/data-source"), { recursive: true });
      await runSpecRecord({
        root,
        docType: "srs",
        specs: [{ statement: "spec", extractedFrom: [], patch: SAMPLE_PATCH }],
      });
      await runSpecApprove({ root, docType: "srs", id: "SPEC-001" });
      const { readdir } = await import("node:fs/promises");
      expect(await readdir(join(root, "docs/data-source"))).toHaveLength(0);
    });
  });

  it("lists across doc types and filters by status", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await runSpecRecord({ root, docType: "srs", specs: [{ statement: "a", extractedFrom: [] }] });
      await runSpecRecord({
        root,
        docType: "basic-design",
        specs: [{ statement: "b", extractedFrom: [] }],
      });
      const all = await runSpecList({ root });
      expect(all.total).toBe(2);
      expect(all.stores.map((s) => s.docType).sort()).toEqual(["basic-design", "srs"]);
      const pending = await runSpecList({ root, status: "pending" });
      expect(pending.total).toBe(2);
    });
  });
});
