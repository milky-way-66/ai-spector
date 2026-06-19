import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { runCheck } from "@/core/operations/check.js";
import { runSyncSnapshot } from "@/core/sync/snapshot.js";
import { withTempDir } from "../helpers/temp-project.js";

const exec = promisify(execFile);

const MIN_CONFIG = {
  languages: [{ code: "en", label: "English" }],
  paths: { graph: ".ai-spector/graph/traceability.json" },
};

async function scaffoldMinimalWithDesignDoc(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify(MIN_CONFIG),
    "utf8",
  );
  await mkdir(join(root, "docs/data-source"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await mkdir(join(root, ".ai-spector/templates"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/context"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/.docflow/tasks/index.json"),
    JSON.stringify({ version: 1, active: {}, recent: [] }),
    "utf8",
  );
  await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/graph/traceability.json"),
    '{"nodes":[],"edges":[]}',
    "utf8",
  );
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await writeFile(join(root, "docs/srs/en/overview.md"), "# Overview\n", "utf8");
}

describe("runCheck SYNC-001 drift hint", () => {
  it("emits SYNC-001 when design layer drifts from baseline", async () => {
    await withTempDir(async (root) => {
      await exec("git", ["init"], { cwd: root });
      await exec("git", ["config", "user.email", "t@example.com"], { cwd: root });
      await exec("git", ["config", "user.name", "Test"], { cwd: root });
      await scaffoldMinimalWithDesignDoc(root);
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init"], { cwd: root });

      await runSyncSnapshot({ root, label: "test", force: true });

      const before = await runCheck({ root });
      expect(before.findings.some((f) => f.ruleId === "SYNC-001")).toBe(false);

      await writeFile(join(root, "docs/srs/en/overview.md"), "# Overview\n\nChanged\n", "utf8");

      const after = await runCheck({ root });
      const sync = after.findings.find((f) => f.ruleId === "SYNC-001");
      expect(sync).toBeDefined();
      expect(sync?.severity).toBe("info");
      expect(sync?.message).toBe("Design layer drift detected — run sync audit");
      expect(after.ok).toBe(true);
    });
  });
});
