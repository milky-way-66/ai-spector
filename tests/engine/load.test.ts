// tests/engine/load.test.ts
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadEngineConfig, defaultEngineConfig } from "../../src/core/engine/load.js";

describe("loadEngineConfig", () => {
  it("returns defaults when engine.json missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "engine-"));
    const cfg = await loadEngineConfig(root);
    expect(cfg.schemaVersion).toBe(1);
    expect(cfg.artifacts.graph).toBe(".ai-spector/graph/traceability.graph.json");
    expect(cfg.artifacts.tasks).toBe(".ai-spector/.docflow/tasks");
    expect(cfg.readiness.profile).toBe("general");
  });

  it("merges persisted engine.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "engine-"));
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/engine.json"),
      JSON.stringify({ schemaVersion: 1, scaffoldVersion: "0.8.98", readiness: { profile: "regulated" } }),
      "utf8",
    );
    const cfg = await loadEngineConfig(root);
    expect(cfg.scaffoldVersion).toBe("0.8.98");
    expect(cfg.readiness.profile).toBe("regulated");
    expect(cfg.artifacts.graph).toBe(defaultEngineConfig().artifacts.graph);
  });
});
