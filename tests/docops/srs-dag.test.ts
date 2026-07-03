import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffoldBundleRoot } from "../../src/core/config/load.js";

interface DagNode {
  id: string;
  dependsOn?: string[];
  mode?: string;
}

interface DagFile {
  nodes: DagNode[];
}

describe("builtin SRS dag.json", () => {
  it("includes per-UC use-case-detail wave after use-cases index", async () => {
    const dagPath = join(
      scaffoldBundleRoot(),
      ".ai-spector",
      ".docflow",
      "config",
      "doc-types",
      "srs",
      "dag.json",
    );
    const dag = JSON.parse(await readFile(dagPath, "utf8")) as DagFile;
    const ids = dag.nodes.map((n) => n.id);

    expect(ids).toContain("srs.use-case-detail");

    const ucDetail = dag.nodes.find((n) => n.id === "srs.use-case-detail");
    expect(ucDetail?.mode).toBe("perUseCase");
    expect(ucDetail?.dependsOn).toEqual(["srs.use-cases"]);

    const featuresList = dag.nodes.find((n) => n.id === "srs.features-list");
    expect(featuresList?.dependsOn).toEqual(["srs.use-case-detail"]);
  });
});
