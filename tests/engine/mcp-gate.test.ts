import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { gateMcpTool } from "../../src/core/engine/gate-mcp.js";
import { mergeDocopsDefaults } from "../../src/core/docops/config.js";

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

describe("gateMcpTool", () => {
  const writerUiOff = mergeDocopsDefaults({
    capabilities: {
      review: true,
      comments: true,
      prototype: true,
      graph: false,
      generate: false,
      translate: false,
    },
  });

  it("allows graph_query when capabilities.graph is false (Writer UI only)", () => {
    const result = gateMcpTool("graph_query", writerUiOff);
    expect(result.allowed).toBe(true);
  });

  it("allows index when capabilities.graph is false", () => {
    expect(gateMcpTool("index", writerUiOff).allowed).toBe(true);
  });

  it("allows context_record when capabilities.generate is false", () => {
    expect(gateMcpTool("context_record", writerUiOff).allowed).toBe(true);
  });

  it("blocks contract_review when review disabled", () => {
    const config = mergeDocopsDefaults({
      capabilities: {
        review: false,
        comments: true,
        prototype: true,
        graph: true,
        generate: true,
        translate: false,
      },
    });
    const result = gateMcpTool("contract_review", config);
    expect(result.allowed).toBe(false);
    expect(result.capability).toBe("review");
  });
});

describe("probeGenerateGatePending", () => {
  it("detects plan awaiting approval", async () => {
    const { probeGenerateGatePending } = await import("../../src/core/docops/generate-gate-probe.js");
    const root = await mkdtemp(join(tmpdir(), "aispector-gate-"));
    const tasksDir = join(root, ".ai-spector/.docflow/tasks");
    await mkdir(tasksDir, { recursive: true });
    await writeJson(join(tasksDir, "index.json"), { active: { "generate-srs": "task-abc" } });
    await writeJson(join(tasksDir, "task-abc.json"), {
      kind: "generate",
      planApprovedAt: null,
      plan: { kind: "generate" },
      phaseStatus: "awaiting_user",
      snapshot: { planPresentedAt: "2026-07-03T00:00:00Z" },
    });
    expect(await probeGenerateGatePending(root)).toBe(true);
  });
});
