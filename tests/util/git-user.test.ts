import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { withTempDir } from "../helpers/temp-project.js";
import { getGitUserEmail, getGitUserName, resolveReviewActor } from "@/core/util/git-user.js";

const exec = promisify(execFile);

async function initGitRepo(
  root: string,
  opts: { email?: string; name?: string } = {},
): Promise<void> {
  await exec("git", ["init"], { cwd: root });
  await exec(
    "git",
    ["config", "user.email", opts.email ?? "reviewer@example.com"],
    { cwd: root },
  );
  await exec("git", ["config", "user.name", opts.name ?? "Reviewer"], { cwd: root });
}

describe("git-user", () => {
  it("reads user.email from repo git config", async () => {
    await withTempDir(async (root) => {
      await initGitRepo(root, { email: "alice@company.com" });
      await expect(getGitUserEmail(root)).resolves.toBe("alice@company.com");
    });
  });

  it("reads user.name from repo git config", async () => {
    await withTempDir(async (root) => {
      await initGitRepo(root, { name: "Alice Smith" });
      await expect(getGitUserName(root)).resolves.toBe("Alice Smith");
    });
  });

  it("resolves generic by=user to git email and username with role user", async () => {
    await withTempDir(async (root) => {
      await initGitRepo(root, { email: "bob@company.com", name: "Bob Smith" });
      await expect(resolveReviewActor(root, { by: "user" })).resolves.toEqual({
        by: "bob@company.com",
        username: "Bob Smith",
        role: "user",
      });
    });
  });

  it("keeps explicit email and username overrides", async () => {
    await withTempDir(async (root) => {
      await initGitRepo(root, { email: "bob@company.com", name: "Bob Smith" });
      await expect(
        resolveReviewActor(root, {
          by: "carol@client.com",
          username: "Carol Client",
          role: "client",
        }),
      ).resolves.toEqual({
        by: "carol@client.com",
        username: "Carol Client",
        role: "client",
      });
    });
  });

  it("falls back to unknown when git identity is unavailable", async () => {
    await withTempDir(async (root) => {
      await mkdir(root, { recursive: true });
      await expect(resolveReviewActor(root, { by: "user" })).resolves.toEqual({
        by: "unknown",
        username: "unknown",
        role: "user",
      });
    });
  });
});
