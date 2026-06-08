import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runInit } from "../../src/core/operations/init.js";
import { runSyncCursor } from "../../src/core/operations/sync-cursor.js";
import { pathExists } from "../../src/core/util/fs.js";

describe("sync-cursor", () => {
  it("refreshes skills and WORKFLOW without full re-init", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-sync-"));
    await runInit({ targetDir: root });

    const skillPath = join(root, ".cursor/skills/ai-spector-graph/SKILL.md");
    expect(await pathExists(skillPath)).toBe(true);

    const { rm } = await import("node:fs/promises");
    await rm(skillPath, { force: true });

    await runSyncCursor({ targetDir: root });

    expect(await pathExists(skillPath)).toBe(true);
    const router = await readFile(
      join(root, ".cursor/skills/_skill-router.md"),
      "utf8",
    );
    expect(router).toContain("ai-spector-resolve-comments");
    expect(router).toContain("ai-spector-generate");
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate-prototype/SKILL.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/WORKFLOW.md"))).toBe(true);
  });
});
