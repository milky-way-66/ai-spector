import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { runPreCommitCheck, installGitHooks } from "../../src/core/operations/hooks.js";
import { writeJson } from "../../src/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";

const exec = promisify(execFile);

async function gitInit(root: string): Promise<void> {
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
}

async function setupProject(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [
      { code: "en", label: "English" },
      { code: "jp", label: "Japanese" },
    ],
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
  });
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await mkdir(join(root, "docs/srs/jp"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/translation-queue/changes"), { recursive: true });
}

describe("hooks pre-commit", () => {
  it("skips when no staged doc files", async () => {
    await withTempProject(async (root) => {
      await gitInit(root);
      await setupProject(root);
      const report = await runPreCommitCheck({ root });
      expect(report.skipped).toBe(true);
      expect(report.errors).toHaveLength(0);
    });
  });

  it("warns on pending translation jobs for staged docs", async () => {
    await withTempProject(async (root) => {
      await gitInit(root);
      await setupProject(root);

      await writeFile(join(root, "docs/srs/en/01-overview.md"), "# Overview\n\nEnglish.\n", "utf8");
      await writeFile(join(root, "docs/srs/jp/01-overview.md"), "# Overview\n\n日本語。\n", "utf8");

      await writeJson(join(root, ".ai-spector/.docflow/translation-queue/pending.json"), {
        version: 1,
        jobs: [
          {
            id: "job-1",
            docType: "srs",
            relativePath: "01-overview.md",
            direction: "outbound",
            origin: { lang: "en", path: "docs/srs/en/01-overview.md", hash: "abc", changedAt: "" },
            targets: [{ lang: "jp", path: "docs/srs/jp/01-overview.md", status: "pending" }],
            createdAt: "",
            updatedAt: "",
          },
        ],
      });
      await writeJson(
        join(root, ".ai-spector/.docflow/translation-queue/changes/srs--01-overview.md.json"),
        {
          version: 1,
          docType: "srs",
          relativePath: "01-overview.md",
          jobId: "job-1",
          updatedAt: "",
          changes: [],
        },
      );

      await exec("git", ["add", "docs/srs/en/01-overview.md"], { cwd: root });

      const report = await runPreCommitCheck({ root, skipImpact: true });
      expect(report.skipped).toBe(false);
      expect(report.errors).toHaveLength(0);
      expect(report.warnings.some((w) => w.includes("pending translation"))).toBe(true);
    });
  });

  it("installs pre-commit hook in git repo", async () => {
    await withTempProject(async (root) => {
      await gitInit(root);
      await setupProject(root);
      const hookPath = await installGitHooks(root);
      expect(hookPath).toContain("pre-commit");
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(hookPath, "utf8");
      expect(content).toContain("ai-spector hooks pre-commit");
    });
  });
});
