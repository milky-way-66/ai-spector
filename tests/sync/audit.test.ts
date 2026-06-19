import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runSyncSnapshot } from "@/core/sync/snapshot.js";
import { runSyncAudit } from "@/core/sync/audit.js";

const exec = promisify(execFile);

async function setupGitProject() {
  const root = await mkdtemp(join(tmpdir(), "sync-audit-"));
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "t@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  await mkdir(join(root, "docs/basic-design"), { recursive: true });
  await writeFile(join(root, "docs/basic-design/api.md"), "# v1\n");
  await mkdir(join(root, ".ai-spector/.docflow"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ paths: { graph: ".ai-spector/graph.json" } }),
  );
  await writeFile(join(root, ".ai-spector/graph.json"), '{"nodes":[],"edges":[]}');
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "init"], { cwd: root });
  return root;
}

describe("runSyncAudit", () => {
  it("reports no drift when unchanged", async () => {
    const root = await setupGitProject();
    await runSyncSnapshot({ root, force: true });
    const result = await runSyncAudit({ root });
    expect(result.drift.hasDrift).toBe(false);
  });

  it("reports modified file with git diff", async () => {
    const root = await setupGitProject();
    await runSyncSnapshot({ root, force: true });
    await writeFile(join(root, "docs/basic-design/api.md"), "# v2\n");
    const result = await runSyncAudit({ root });
    expect(result.drift.hasDrift).toBe(true);
    const mod = result.drift.byLayer["basic-design"].modified;
    expect(mod[0]?.path).toBe("docs/basic-design/api.md");
    expect(mod[0]?.diffSource).toBe("git");
    expect(mod[0]?.diff).toContain("v2");
  });

  it("throws when baseline missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-no-base-"));
    await mkdir(join(root, ".ai-spector/.docflow"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      JSON.stringify({ paths: { graph: ".ai-spector/graph.json" } }),
    );
    await expect(runSyncAudit({ root })).rejects.toThrow(/sync snapshot/i);
  });
});
