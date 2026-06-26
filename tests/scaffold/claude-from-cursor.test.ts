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
  it("builds exactly 4 ai-spector* skill dirs in cursor and claude bundles", async () => {
    const result = await buildClaudeScaffoldFromCursor();
    expect(result.skillCount).toBe(4);

    // Verify exactly the 4 expected skills exist in claude bundle
    const expectedSkills = ["ai-spector", "ai-spector-contract", "ai-spector-generate", "ai-spector-graph"];
    for (const skill of expectedSkills) {
      expect(
        await pathExists(join(result.claudeRoot, `.claude/skills/${skill}/skill.md`)),
        `expected ${skill}/skill.md to exist`,
      ).toBe(true);
    }

    // Verify no retired skills exist
    const retiredSkills = ["ai-spector-review", "ai-spector-resolve-comments", "ai-spector-task",
      "ai-spector-setup", "ai-spector-check", "ai-spector-generate-srs"];
    for (const skill of retiredSkills) {
      expect(
        await pathExists(join(result.claudeRoot, `.claude/skills/${skill}`)),
        `expected retired skill ${skill} to NOT exist`,
      ).toBe(false);
    }
  });

  it("generates contract skill with review + comments runbook", async () => {
    const result = await buildClaudeScaffoldFromCursor();

    const contractSkill = join(result.claudeRoot, ".claude/skills/ai-spector-contract/skill.md");
    expect(await pathExists(contractSkill)).toBe(true);
    const contractText = await readFile(contractSkill, "utf8");
    expect(contractText).toContain("ai-spector-contract");
    expect(contractText).toContain("references/runbook.md");

    const runbook = join(
      result.claudeRoot,
      ".claude/skills/ai-spector-contract/references/runbook.md",
    );
    expect(await pathExists(runbook)).toBe(true);
    const runbookText = await readFile(runbook, "utf8");
    expect(runbookText).toContain("review_decline");
    expect(runbookText).toContain("quorum");
    expect(runbookText).toContain("contract_comments");
    expect(runbookText).toContain("lang_queue");
  });

  it("generates generate skill with consolidated runbook", async () => {
    const result = await buildClaudeScaffoldFromCursor();

    const generateRunbook = join(
      result.claudeRoot,
      ".claude/skills/ai-spector-generate/references/runbook.md",
    );
    expect(await pathExists(generateRunbook)).toBe(true);
    const runbookText = await readFile(generateRunbook, "utf8");
    expect(runbookText).toContain("work_approve_plan");
    expect(runbookText).toContain("Resolve-Task");
    expect(runbookText).toContain("Template-Import");
  });

  it("generates graph skill with search and sync-audit runbooks", async () => {
    const result = await buildClaudeScaffoldFromCursor();

    expect(
      await pathExists(join(result.claudeRoot, ".claude/skills/ai-spector-graph/references/search.md")),
    ).toBe(true);
    expect(
      await pathExists(join(result.claudeRoot, ".claude/skills/ai-spector-graph/references/sync-audit.md")),
    ).toBe(true);
  });

  it("generates router and scaffold files", async () => {
    const result = await buildClaudeScaffoldFromCursor();

    expect(await pathExists(join(result.claudeRoot, ".claude/skills/README.md"))).toBe(true);
    expect(await pathExists(join(result.claudeRoot, ".claude/rules/ai-spector-routing.mdc"))).toBe(true);

    const claudeMd = await readFile(join(result.claudeRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("review_approve");
    expect(claudeMd).toContain("workflow_route");
    expect(claudeMd).toContain("ai-spector-contract");
    expect(claudeMd).toContain("ai-spector-generate");
    expect(claudeMd).toContain("ai-spector-graph");

    const router = await readFile(
      join(result.claudeRoot, ".claude/skills/_skill-router.md"),
      "utf8",
    );
    expect(router).toContain("ai-spector-contract");
    expect(router).toContain("WORKFLOW.md");

    const claudeWorkflow = await readFile(join(result.claudeRoot, "WORKFLOW.md"), "utf8");
    expect(claudeWorkflow).toContain("ai-spector-contract");
    expect(claudeWorkflow).toContain("ai-spector-generate");

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
    expect(router).toContain("ai-spector-contract");
    expect(await pathExists(join(root, "CLAUDE.md"))).toBe(true);
    expect(await pathExists(join(root, "WORKFLOW.md"))).toBe(true);
    expect(await pathExists(join(root, ".claude/skills/README.md"))).toBe(true);
    expect(await pathExists(join(root, ".claude/rules/ai-spector-plan-gate.mdc"))).toBe(true);
    // Check the 4 skills are present
    expect(await pathExists(join(root, ".claude/skills/ai-spector/skill.md"))).toBe(true);
    expect(await pathExists(join(root, ".claude/skills/ai-spector-contract/skill.md"))).toBe(true);
    expect(await pathExists(join(root, ".claude/skills/ai-spector-generate/skill.md"))).toBe(true);
    expect(await pathExists(join(root, ".claude/skills/ai-spector-graph/skill.md"))).toBe(true);

    expect(scaffoldClaudeBundleRoot()).toContain("scaffold/claude");
    expect(scaffoldCursorBundleRoot()).toContain("scaffold/cursor");
  });
});
