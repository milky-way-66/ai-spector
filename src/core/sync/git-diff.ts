import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf8",
    });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function resolveGitRef(cwd: string, ref = "HEAD"): Promise<string | null> {
  if (!(await isGitRepo(cwd))) return null;
  try {
    const { stdout } = await exec("git", ["rev-parse", ref], { cwd, encoding: "utf8" });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export function countUnifiedDiffLines(diff: string): { linesAdded: number; linesRemoved: number } {
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) linesAdded++;
    else if (line.startsWith("-")) linesRemoved++;
  }
  return { linesAdded, linesRemoved };
}

export async function gitDiffFromRef(
  cwd: string,
  ref: string,
  path: string,
): Promise<{ diff: string; linesAdded: number; linesRemoved: number }> {
  try {
    const { stdout } = await exec("git", ["diff", ref, "--", path], {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const counts = countUnifiedDiffLines(stdout);
    return { diff: stdout, ...counts };
  } catch {
    return { diff: "", linesAdded: 0, linesRemoved: 0 };
  }
}
