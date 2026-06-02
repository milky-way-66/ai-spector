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

  it("installs .cursor skills and WORKFLOW from scaffold/cursor/", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-init-cursor-"));

    await runInit({ targetDir: root });

    expect(await pathExists(join(root, ".cursor/WORKFLOW.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-graph/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-graph/references/analyze.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate-srs/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate-srs/references/runbook.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate-basic-design/SKILL.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate-detail-design/SKILL.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate-prototype/SKILL.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-resolve-comments/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/README.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/_skill-router.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/commands"))).toBe(false);

    const workflow = await readFile(join(root, ".cursor/WORKFLOW.md"), "utf8");
    expect(workflow).toContain("ai-spector-graph");
    expect(await pathExists(join(root, "cursor"))).toBe(false);
  });
});
