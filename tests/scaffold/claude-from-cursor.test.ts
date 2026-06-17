import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildClaudeScaffoldFromCursor,
  cursorSkillToClaudeSkill,
  stripPathsFrontmatter,
  transformCursorPaths,
} from "@/core/scaffold/claude-from-cursor.js";
import { runInit } from "@/core/operations/init.js";
import { runSyncClaude } from "@/core/operations/sync-claude.js";
import { scaffoldClaudeBundleRoot, scaffoldCursorBundleRoot } from "@/core/config/load.js";
import { pathExists } from "@/core/util/fs.js";

describe("claude-from-cursor transforms", () => {
  it("rewrites cursor paths and strips paths frontmatter", () => {
    const input = `---
name: ai-spector-review
description: review docs
paths:
  - ".ai-spector/.docflow/review-queue/**"
  - "docs/**"
---

Read [.cursor/skills/ai-spector-review/SKILL.md](.cursor/skills/ai-spector-review/SKILL.md)
`;

    const out = cursorSkillToClaudeSkill(input);
    expect(out).not.toContain("paths:");
    expect(out).toContain(".claude/skills/ai-spector-review/skill.md");
    expect(out).not.toContain("SKILL.md");
  });

  it("stripPathsFrontmatter leaves skills without paths unchanged", () => {
    const input = `---
name: test
description: ok
---

body
`;
    expect(stripPathsFrontmatter(input)).toBe(input);
  });

  it("transformCursorPaths fixes router and workflow links", () => {
    const text = transformCursorPaths(
      "see ai-spector-routing.mdc and [.cursor/WORKFLOW.md](../WORKFLOW.md)",
    );
    expect(text).toContain("_skill-router.md");
    expect(text).toContain(".claude/WORKFLOW.md");
  });
});

describe("buildClaudeScaffoldFromCursor", () => {
  it("generates review skill and router from cursor bundle", async () => {
    const result = await buildClaudeScaffoldFromCursor();
    expect(result.skillCount).toBeGreaterThanOrEqual(15);

    const reviewSkill = join(result.claudeRoot, ".claude/skills/ai-spector-review/skill.md");
    expect(await pathExists(reviewSkill)).toBe(true);
    const reviewText = await readFile(reviewSkill, "utf8");
    expect(reviewText).toContain("ai-spector-review");
    expect(reviewText).toContain("references/runbook.md");

    const runbook = join(
      result.claudeRoot,
      ".claude/skills/ai-spector-review/references/runbook.md",
    );
    expect(await pathExists(runbook)).toBe(true);
    const runbookText = await readFile(runbook, "utf8");
    expect(runbookText).toContain("review_decline");
    expect(runbookText).toContain("quorum");

    const srsContext = join(
      result.claudeRoot,
      ".claude/skills/ai-spector-generate-srs/references/srs-context/introduction.md",
    );
    expect(await pathExists(srsContext)).toBe(true);

    expect(await pathExists(join(result.claudeRoot, ".claude/skills/README.md"))).toBe(true);
    expect(await pathExists(join(result.claudeRoot, ".claude/rules/ai-spector-routing.mdc"))).toBe(
      true,
    );

    const claudeMd = await readFile(join(result.claudeRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("review_approve");
    expect(claudeMd).toContain("review_decline");
    expect(claudeMd).toContain("workflow_route");
    expect(claudeMd).toContain("workflow: generate-detail-design");
    expect(claudeMd).toContain(".claude/workflows/");

    const router = await readFile(
      join(result.claudeRoot, ".claude/skills/_skill-router.md"),
      "utf8",
    );
    expect(router).toContain("ai-spector-review");
    expect(router).toContain("WORKFLOW.md");

    const ddWorkflow = join(
      result.claudeRoot,
      ".claude/workflows/generate-detail-design.md",
    );
    expect(await pathExists(ddWorkflow)).toBe(true);
    const ddText = await readFile(ddWorkflow, "utf8");
    expect(ddText).toContain("ai-spector-generate-detail-design");
    expect(ddText).toContain("Do **not** use `ai-spector-resolve-task`");

    const claudeWorkflow = await readFile(join(result.claudeRoot, "WORKFLOW.md"), "utf8");
    expect(claudeWorkflow).toContain("workflow: generate-detail-design");
    expect(claudeWorkflow).not.toContain("/generate-detail-design");

    const claudeRouting = await readFile(
      join(result.claudeRoot, ".claude/rules/ai-spector-routing.mdc"),
      "utf8",
    );
    expect(claudeRouting).toContain("Workflow triggers (override)");
    expect(claudeRouting).toContain(".claude/workflows/");
  });
});

describe("sync-claude", () => {
  it("refreshes CLAUDE.md and skills without full re-init", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-sync-claude-"));
    await runInit({ targetDir: root, target: "claude", yes: true });

    const skillPath = join(root, ".claude/skills/ai-spector-graph/skill.md");
    expect(await pathExists(skillPath)).toBe(true);

    const { rm } = await import("node:fs/promises");
    await rm(skillPath, { force: true });

    await runSyncClaude({ targetDir: root });

    expect(await pathExists(skillPath)).toBe(true);
    const router = await readFile(join(root, ".claude/skills/_skill-router.md"), "utf8");
    expect(router).toContain("ai-spector-review");
    expect(await pathExists(join(root, "CLAUDE.md"))).toBe(true);
    expect(await pathExists(join(root, "WORKFLOW.md"))).toBe(true);
    expect(await pathExists(join(root, ".claude/skills/README.md"))).toBe(true);
    expect(await pathExists(join(root, ".claude/rules/ai-spector-plan-gate.mdc"))).toBe(true);
    expect(await pathExists(join(root, ".claude/workflows/generate-detail-design.md"))).toBe(true);

    expect(scaffoldClaudeBundleRoot()).toContain("scaffold/claude");
    expect(scaffoldCursorBundleRoot()).toContain("scaffold/cursor");
  });
});
