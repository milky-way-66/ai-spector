import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copyFile } from "node:fs/promises";
import { packageBundleRoot } from "../../src/core/config/load.js";
import { assessReadiness } from "../../src/core/readiness/assess.js";

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function scaffoldMinimalProject(root: string) {
  const ai = join(root, ".ai-spector");
  await mkdir(join(ai, ".docflow/config"), { recursive: true });
  await mkdir(join(ai, "graph"), { recursive: true });
  await mkdir(join(ai, ".docflow/context"), { recursive: true });

  const srcCriteria = join(
    packageBundleRoot(),
    "scaffold/.ai-spector/.docflow/config/readiness-criteria.srs.json",
  );
  await copyFile(srcCriteria, join(ai, ".docflow/config/readiness-criteria.srs.json"));

  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [{ code: "en", label: "English" }],
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
    },
    packs: { srs: "builtin", basicDesign: "builtin" },
  });

  await writeJson(join(ai, "graph/traceability.graph.json"), {
    version: 1,
    nodes: [
      { id: "system", type: "system", name: "Test", description: "A test system" },
      { id: "actor-1", type: "actor", name: "User" },
    ],
    edges: [],
  });

  await writeJson(join(ai, ".docflow/context/srs.json"), {
    version: 1,
    docType: "srs",
    entries: [],
  });
}

describe("assessReadiness", () => {
  it("returns structured report for builtin SRS", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-rdy-"));
    await scaffoldMinimalProject(root);

    const result = await assessReadiness({
      root,
      docType: "srs",
      targets: ["srs.introduction"],
      targetAll: false,
    });

    expect(result.docType).toBe("srs");
    expect(result.profile).toBe("general");
    expect(result.criteria.length).toBeGreaterThan(0);
    expect(result.summary.total).toBeGreaterThan(0);
    expect(result.inventory.graphLoaded).toBe(true);
    expect(result.inventory.nodeCounts.actor).toBe(1);
    expect(Array.isArray(result.questionsForUser)).toBe(true);
    expect(Array.isArray(result.blockingGaps)).toBe(true);
  });

  it("regulated profile adds REG criteria", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-rdy-"));
    await scaffoldMinimalProject(root);

    const result = await assessReadiness({
      root,
      profile: "regulated",
      targetAll: true,
    });

    expect(result.profile).toBe("regulated");
    expect(result.appliedProfiles).toContain("regulated");
    expect(result.criteria.some((c) => c.id.startsWith("REG-"))).toBe(true);
  });
});
