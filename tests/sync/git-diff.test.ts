import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveGitRef, gitDiffFromRef } from "@/core/sync/git-diff.js";

const exec = promisify(execFile);

async function git(cwd: string, args: string[]) {
  await exec("git", args, { cwd });
}

describe("sync git-diff", () => {
  it("resolves HEAD and diffs changed file", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-git-"));
    await git(root, ["init"]);
    await git(root, ["config", "user.email", "t@example.com"]);
    await git(root, ["config", "user.name", "Test"]);
    await mkdir(join(root, "docs/srs"), { recursive: true });
    const file = "docs/srs/a.md";
    await writeFile(join(root, file), "# v1\n");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "baseline"]);
    const ref = await resolveGitRef(root, "HEAD");
    expect(ref).toBeTruthy();
    await writeFile(join(root, file), "# v2\n");
    const { diff, linesAdded, linesRemoved } = await gitDiffFromRef(root, ref!, file);
    expect(diff).toContain("v2");
    expect(linesAdded + linesRemoved).toBeGreaterThan(0);
  });
});
