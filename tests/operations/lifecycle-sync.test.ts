import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIFECYCLE_PATH } from "@/core/docops/lifecycle.js";
import { runLifecycleSync } from "@/core/operations/lifecycle.js";
import { pathExists, readJson } from "@/core/util/fs.js";
import { scaffoldDocopsMinimal } from "../helpers/docops-scaffold.js";
import { withTempDir } from "../helpers/temp-project.js";

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
});
