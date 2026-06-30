import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { probeGitPushedToUpstream } from "@/core/util/git-push.js";
import { withTempDir } from "../helpers/temp-project.js";

const exec = promisify(execFile);

async function initBareAndClone(workRoot: string): Promise<{ repo: string; bare: string }> {
  const bare = join(workRoot, "remote.git");
  const repo = join(workRoot, "repo");
  await exec("git", ["init", "--bare", bare]);
  await exec("git", ["clone", bare, repo]);
  await exec("git", ["config", "user.email", "test@example.com"], { cwd: repo });
  await exec("git", ["config", "user.name", "Test"], { cwd: repo });
  await writeFile(join(repo, "README.md"), "# test\n", "utf8");
  await exec("git", ["add", "README.md"], { cwd: repo });
  await exec("git", ["commit", "-m", "init"], { cwd: repo });
  await exec("git", ["push", "-u", "origin", "HEAD"], { cwd: repo });
  return { repo, bare };
}

describe("probeGitPushedToUpstream", () => {
  it("returns true when HEAD matches upstream", async () => {
    await withTempDir(async (workRoot) => {
      const { repo } = await initBareAndClone(workRoot);
      expect(await probeGitPushedToUpstream(repo)).toBe(true);
    });
  });

  it("returns false when local commits are ahead of upstream", async () => {
    await withTempDir(async (workRoot) => {
      const { repo } = await initBareAndClone(workRoot);
      await writeFile(join(repo, "local.md"), "x\n", "utf8");
      await exec("git", ["add", "local.md"], { cwd: repo });
      await exec("git", ["commit", "-m", "local"], { cwd: repo });
      expect(await probeGitPushedToUpstream(repo)).toBe(false);
    });
  });

  it("returns false outside a git repo", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, "nested"), { recursive: true });
      expect(await probeGitPushedToUpstream(join(root, "nested"))).toBe(false);
    });
  });
});
