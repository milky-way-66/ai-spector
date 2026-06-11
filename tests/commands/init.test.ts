import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile);
import { loadDocflowConfig, resolveProjectTemplatesDir } from "../../src/core/config/load.js";
import { runInit } from "../../src/core/operations/init.js";
import { pathExists } from "../../src/core/util/fs.js";

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
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate-prototype/SKILL.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-setup/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-lang-status/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-resolve-translation/SKILL.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-resolve-comments/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-resolve-task/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-resolve-task/references/runbook.md"))).toBe(
      true,
    );
    expect(await pathExists(join(root, ".cursor/skills/README.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/_skill-router.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/commands/_workflow.md"))).toBe(true);

    const workflow = await readFile(join(root, ".cursor/WORKFLOW.md"), "utf8");
    expect(workflow).toContain("ai-spector-graph");
    expect(await pathExists(join(root, "cursor"))).toBe(false);
  });

  it("initializes git and installs pre-commit hook", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-init-hook-"));

    await runInit({ targetDir: root });

    expect(await pathExists(join(root, ".git"))).toBe(true);

    const { stdout: gitDirRaw } = await exec("git", ["rev-parse", "--absolute-git-dir"], {
      cwd: root,
    });
    const hookPath = join(gitDirRaw.trim(), "hooks", "pre-commit");
    expect(await pathExists(hookPath)).toBe(true);

    const hook = await readFile(hookPath, "utf8");
    expect(hook).toContain("ai-spector hooks pre-commit");
  });
});
