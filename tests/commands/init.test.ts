import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile);
import { loadDocflowConfig, resolveProjectTemplatesDir } from "@/core/config/load.js";
import { runInit } from "@/core/operations/init.js";
import { pathExists } from "@/core/util/fs.js";

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

  it("installs exactly 4 ai-spector* cursor skills and WORKFLOW from scaffold/cursor/", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-init-cursor-"));

    await runInit({ targetDir: root });

    expect(await pathExists(join(root, ".cursor/WORKFLOW.md"))).toBe(true);

    // The 4 expected skills
    expect(await pathExists(join(root, ".cursor/skills/ai-spector/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-contract/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate/SKILL.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-graph/SKILL.md"))).toBe(true);

    // Graph skill still has existing references
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-graph/references/analyze.md"))).toBe(true);

    // Generate skill has consolidated runbook
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-generate/references/runbook.md"))).toBe(true);

    // Contract skill has consolidated runbook
    expect(await pathExists(join(root, ".cursor/skills/ai-spector-contract/references/runbook.md"))).toBe(true);

    // Retired skills must NOT exist
    const retiredSkills = [
      "ai-spector-generate-srs", "ai-spector-generate-basic-design",
      "ai-spector-generate-detail-design", "ai-spector-generate-prototype",
      "ai-spector-setup", "ai-spector-lang-status", "ai-spector-resolve-translation",
      "ai-spector-resolve-comments", "ai-spector-resolve-task", "ai-spector-review",
      "ai-spector-task", "ai-spector-check",
    ];
    for (const skill of retiredSkills) {
      expect(
        await pathExists(join(root, `.cursor/skills/${skill}`)),
        `expected retired skill ${skill} to NOT exist`,
      ).toBe(false);
    }

    expect(await pathExists(join(root, ".cursor/rules/ai-spector-routing.mdc"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/README.md"))).toBe(true);
    expect(await pathExists(join(root, ".cursor/skills/_skill-router.md"))).toBe(true);

    const workflow = await readFile(join(root, ".cursor/WORKFLOW.md"), "utf8");
    expect(workflow).toContain("ai-spector-graph");
    expect(workflow).toContain("ai-spector-contract");
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
