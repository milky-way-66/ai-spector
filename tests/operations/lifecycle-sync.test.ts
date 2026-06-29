import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_PATH,
  markLifecycleStepDone,
  readLifecycle,
} from "@/core/docops/lifecycle.js";
import { runLifecycleSync } from "@/core/operations/lifecycle.js";
import { runSetup } from "@/core/operations/setup.js";
import { pathExists, readJson } from "@/core/util/fs.js";
import { scaffoldDocopsMinimal } from "../helpers/docops-scaffold.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("markLifecycleStepDone", () => {
  it("creates lifecycle and marks the requested step done", async () => {
    await withTempDir(async (root) => {
      await scaffoldDocopsMinimal(root);

      const written = await markLifecycleStepDone(root, "docops-init");
      const step = written.steps.find((s) => s.id === "docops-init");
      expect(step?.status).toBe("done");
      expect(step?.completedAt).toBeTruthy();

      const loaded = await readLifecycle(root);
      expect(loaded?.steps.find((s) => s.id === "docops-init")?.status).toBe("done");
    });
  });

  it("does not downgrade blocked steps", async () => {
    await withTempDir(async (root) => {
      await scaffoldDocopsMinimal(root);
      const { buildInitialLifecycle, writeLifecycle } = await import("@/core/docops/lifecycle.js");
      const lc = buildInitialLifecycle({ intent: "migrate", updatedBy: "test" });
      for (const s of lc.steps) {
        if (s.id === "legacy-aligned") {
          s.status = "blocked";
          s.blockedReason = "adopt failed";
        }
      }
      await writeLifecycle(root, lc);

      const written = await markLifecycleStepDone(root, "legacy-aligned");
      expect(written.steps.find((s) => s.id === "legacy-aligned")?.status).toBe("blocked");
    });
  });
});

describe("runLifecycleSync", () => {
  it("marks docops-init done when docops config is present", async () => {
    await withTempDir(async (root) => {
      await scaffoldDocopsMinimal(root);

      const code = await runLifecycleSync({ root, json: true });
      expect(code).toBe(0);

      const lifecyclePath = join(root, LIFECYCLE_PATH);
      expect(await pathExists(lifecyclePath)).toBe(true);

      const written = await readJson<{ steps: Array<{ id: string; status: string }> }>(
        lifecyclePath,
      );
      const byId = Object.fromEntries(written.steps.map((s) => [s.id, s.status]));
      expect(byId["docops-init"]).toBe("done");
    });
  });

  it("runSetup syncs lifecycle when project becomes ready", async () => {
    await withTempDir(async (root) => {
      await runSetup({ root, yes: true, languages: ["en"] });
      const lifecyclePath = join(root, LIFECYCLE_PATH);
      expect(await pathExists(lifecyclePath)).toBe(true);
      const written = await readJson<{ steps: Array<{ id: string; status: string }> }>(
        lifecyclePath,
      );
      const byId = Object.fromEntries(written.steps.map((s) => [s.id, s.status]));
      expect(byId["local-adapter-ready"]).toBe("done");
    });
  });
});
