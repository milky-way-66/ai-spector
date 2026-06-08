import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface CollectedGitDiff {
  diff: string;
  /** No unstaged or staged changes */
  empty: boolean;
  /** Not inside a git repository */
  notRepo?: boolean;
}

/**
 * Working tree changes vs HEAD when possible; otherwise unstaged + staged combined.
 */
export async function collectGitDiff(cwd: string): Promise<CollectedGitDiff> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf8",
    });
    if (stdout.trim() !== "true") {
      return { diff: "", empty: true, notRepo: true };
    }
  } catch {
    return { diff: "", empty: true, notRepo: true };
  }

  let diff = "";
  try {
    const { stdout } = await exec("git", ["rev-parse", "--verify", "HEAD"], {
      cwd,
      encoding: "utf8",
    });
    if (stdout.trim()) {
      const headDiff = await exec("git", ["diff", "HEAD"], { cwd, encoding: "utf8" });
      diff = headDiff.stdout;
    }
  } catch {
    // No commits yet — fall through to unstaged + staged
  }

  if (!diff.trim()) {
    const parts: string[] = [];
    try {
      const unstaged = await exec("git", ["diff"], { cwd, encoding: "utf8" });
      if (unstaged.stdout.trim()) {
        parts.push(unstaged.stdout);
      }
    } catch {
      /* ignore */
    }
    try {
      const staged = await exec("git", ["diff", "--cached"], { cwd, encoding: "utf8" });
      if (staged.stdout.trim()) {
        parts.push(staged.stdout);
      }
    } catch {
      /* ignore */
    }
    diff = parts.join("\n");
  }

  return { diff, empty: !diff.trim() };
}

/** Staged changes only (for pre-commit). */
export async function collectStagedGitDiff(cwd: string): Promise<CollectedGitDiff> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf8",
    });
    if (stdout.trim() !== "true") {
      return { diff: "", empty: true, notRepo: true };
    }
  } catch {
    return { diff: "", empty: true, notRepo: true };
  }

  try {
    const { stdout } = await exec("git", ["diff", "--cached"], { cwd, encoding: "utf8" });
    return { diff: stdout, empty: !stdout.trim() };
  } catch {
    return { diff: "", empty: true };
  }
}

/** Repo-relative paths staged for commit (added, copied, modified, renamed). */
export async function collectStagedFileNames(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await exec(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd, encoding: "utf8" },
    );
    return stdout
      .split("\n")
      .map((line) => line.trim().replace(/\\/g, "/"))
      .filter(Boolean);
  } catch {
    return [];
  }
}
