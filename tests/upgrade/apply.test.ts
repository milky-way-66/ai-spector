import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runUpgradeApply } from "@/core/upgrade/apply.js";
import { withTempDir } from "../helpers/temp-project.js";

vi.mock("@/core/operations/sync-cursor.js", () => ({
  runSyncCursor: vi.fn(async () => ({
    targetDir: "",
    cursorDir: "",
    sourceDir: "",
  })),
}));

describe("runUpgradeApply", () => {
  it("patches packs.basicDesign for legacy config", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await mkdir(join(root, ".cursor/skills/ai-spector"), { recursive: true });
      await writeFile(join(root, ".cursor/skills/ai-spector/SKILL.md"), "---\nname: ai-spector\n", "utf8");
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({
          version: 1,
          scaffoldVersion: "0.4.0",
          languages: [{ code: "en", label: "English" }],
          packs: { srs: "builtin" },
        }),
        "utf8",
      );

      const result = await runUpgradeApply({ root, auto: true });
      expect(result.applied).toContain("UPG-010");

      const config = JSON.parse(
        await (await import("node:fs/promises")).readFile(
          join(root, ".ai-spector/docflow.config.json"),
          "utf8",
        ),
      );
      expect(config.packs.basicDesign).toBe("builtin");
    });
  });
});
