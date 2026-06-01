import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runInit } from "../../src/commands/init.js";
import { runSyncCursor } from "../../src/commands/sync-cursor.js";
import { pathExists } from "../../src/util/fs.js";

describe("sync-cursor", () => {
  it("refreshes commands and skills without full re-init", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-sync-"));
    await runInit({ targetDir: root });

    const skillPath = join(root, ".cursor/skills/ai-spector-graph/SKILL.md");
    expect(await pathExists(skillPath)).toBe(true);

    // Simulate stale install: remove a skill folder
    const { rm } = await import("node:fs/promises");
    await rm(skillPath, { force: true });

    await runSyncCursor({ targetDir: root });

    expect(await pathExists(skillPath)).toBe(true);
    const router = await readFile(
      join(root, ".cursor/skills/_skill-router.md"),
      "utf8",
    );
    expect(router).toContain("ai-spector-resolve-comments");
  });
});
