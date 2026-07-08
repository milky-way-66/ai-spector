import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { migrateFromDocflow } from "../../src/core/docops/migrate.js";
import { loadEngineConfig } from "../../src/core/engine/load.js";
import { readDocopsConfig } from "../../src/core/docops/config.js";
import { pathExists } from "../../src/core/util/fs.js";

const FIXTURE = join(process.cwd(), "tests/fixtures/docflow-legacy");

describe("migrateFromDocflow", () => {
  it("splits docflow.config into docops.config.json and engine.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "migrate-"));
    await cp(FIXTURE, root, { recursive: true });
    const result = await migrateFromDocflow(root, { write: true });
    expect(result.migrated).toBe(true);

    const docops = await readDocopsConfig(root);
    expect(docops?.primaryLanguage).toBe("en");

    const engine = await loadEngineConfig(root);
    expect(engine.scaffoldVersion).toBe("0.8.0");
    expect(engine.readiness.profile).toBe("general");
    expect(engine.artifacts.graph).toBe(".ai-spector/graph/traceability.graph.json");
    expect(await pathExists(join(root, ".docops/guide/README.md"))).toBe(true);
    expect(await pathExists(join(root, ".docops/review.config.json"))).toBe(true);
  });

  it("returns migrated=false when docflow.config.json is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "migrate-no-docflow-"));
    const result = await migrateFromDocflow(root, { write: true });
    expect(result.migrated).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });

  it("skips writing when dryRun=true", async () => {
    const root = await mkdtemp(join(tmpdir(), "migrate-dry-"));
    await cp(FIXTURE, root, { recursive: true });
    const result = await migrateFromDocflow(root, { dryRun: true });
    expect(result.migrated).toBe(true);

    const docops = await readDocopsConfig(root);
    expect(docops).toBeNull();
  });

  it("writes engine.json only when docops.config already exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "migrate-partial-"));
    await cp(FIXTURE, root, { recursive: true });
    const { writeDocopsConfig } = await import("../../src/core/docops/config.js");
    const docops = await readDocopsConfig(root);
    expect(docops).toBeNull();

    await migrateFromDocflow(root, { write: true });
    const first = await readDocopsConfig(root);
    expect(first).not.toBeNull();

    const { unlink } = await import("node:fs/promises");
    await unlink(join(root, ".ai-spector/engine.json"));

    const result = await migrateFromDocflow(root, { write: true });
    expect(result.migrated).toBe(true);
    expect(result.actions.some((a) => a.includes("skip") && a.includes("docops.config"))).toBe(true);
    expect(result.actions.some((a) => a.includes("engine.json"))).toBe(true);

    const engine = await loadEngineConfig(root);
    expect(engine.scaffoldVersion).toBe("0.8.0");
  });
});
