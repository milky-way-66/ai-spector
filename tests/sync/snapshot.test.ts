import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runSyncSnapshot } from "@/core/sync/snapshot.js";
import { loadBaseline } from "@/core/sync/baseline.js";

const exec = promisify(execFile);

describe("runSyncSnapshot", () => {
  it("writes baseline with file hashes and gitRef", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-snap-"));
    await exec("git", ["init"], { cwd: root });
    await exec("git", ["config", "user.email", "t@example.com"], { cwd: root });
    await exec("git", ["config", "user.name", "Test"], { cwd: root });
    await mkdir(join(root, "docs/basic-design"), { recursive: true });
    await writeFile(join(root, "docs/basic-design/api.md"), "# API\n");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "init"], { cwd: root });
    await mkdir(join(root, ".ai-spector/.docflow"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      JSON.stringify({ paths: { graph: ".ai-spector/graph.json" } }),
    );
    await writeFile(join(root, ".ai-spector/graph.json"), '{"nodes":[],"edges":[]}');

    const result = await runSyncSnapshot({ root, label: "test", force: true });
    expect(result.totals.files).toBeGreaterThanOrEqual(1);
    const baseline = await loadBaseline(root);
    expect(baseline?.gitRef).toBeTruthy();
    expect(baseline?.layers["basic-design"].files["docs/basic-design/api.md"]).toBeDefined();
  });
});
