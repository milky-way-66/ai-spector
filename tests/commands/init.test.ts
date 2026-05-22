import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadDocflowConfig, resolveProjectTemplatesDir } from "../../src/config/load.js";
import { runInit } from "../../src/commands/init.js";
import { pathExists } from "../../src/util/fs.js";

describe("runInit", () => {
  it("copies templates into .ai-spector/templates", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-init-"));

    await runInit({ targetDir: root });

    const intro = join(root, ".ai-spector/templates/srs/1-introduction.md");
    const listScreen = join(
      root,
      ".ai-spector/templates/basic_design/list-screen-template.md",
    );
    const readme = join(root, ".ai-spector/templates/README.md");

    expect(await pathExists(intro)).toBe(true);
    expect(await pathExists(listScreen)).toBe(true);
    expect(await pathExists(readme)).toBe(true);

    const raw = await readFile(intro, "utf8");
    expect(raw).toContain("## 1. Introduction");

    const { config } = await loadDocflowConfig(root);
    expect(config.paths.templates).toBe(".ai-spector/templates");
    expect(resolveProjectTemplatesDir(root, config)).toBe(
      join(root, ".ai-spector/templates"),
    );
  });
});
