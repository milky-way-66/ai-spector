import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { migrateFromDocflow } from "../../src/core/docops/migrate.js";
import { loadEngineConfig } from "../../src/core/engine/load.js";
import { readDocopsConfig } from "../../src/core/docops/config.js";

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
});
