import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runUpgradeApply } from "@/core/upgrade/apply.js";
import { runUpgradeScan } from "@/core/upgrade/scan.js";
import { withTempDir } from "../helpers/temp-project.js";

vi.mock("@/core/operations/sync-cursor.js", () => ({
  runSyncCursor: vi.fn(async () => ({
    targetDir: "",
    cursorDir: "",
    sourceDir: "",
  })),
}));

describe("runUpgradeApply", () => {
  it("detects engine.json migration for legacy project and does not auto-apply", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await mkdir(join(root, ".cursor/skills/ai-spector"), { recursive: true });
      await writeFile(join(root, ".cursor/skills/ai-spector/SKILL.md"), "---\nname: ai-spector\n", "utf8");
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({
          version: 1,
          scaffoldVersion: "0.8.0",
          languages: [{ code: "en", label: "English" }],
          packs: { srs: "builtin" },
        }),
        "utf8",
      );

      // UPG-010 is agent-guided (not auto-applied) for engine.json migration
      const result = await runUpgradeApply({ root, auto: true });
      expect(result.applied).not.toContain("UPG-010");

      // UPG-010 should still appear in scan findings (migration needed)
      const scan = await runUpgradeScan({ root, toVersion: "0.9.1" });
      expect(scan.applicableItems).toContain("UPG-010");
      expect(scan.autoFixable).not.toContain("UPG-010");
    });
  });
});
