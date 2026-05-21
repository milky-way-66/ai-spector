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
