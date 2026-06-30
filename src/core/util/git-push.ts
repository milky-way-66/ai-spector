import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** True when the repo has an upstream and HEAD has no unpushed commits. */
export async function probeGitPushedToUpstream(cwd: string): Promise<boolean> {
  try {
    const { stdout: inRepo } = await exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      encoding: "utf8",
    });
    if (inRepo.trim() !== "true") {
      return false;
    }

    await exec("git", ["rev-parse", "--verify", "@{upstream}"], { cwd, encoding: "utf8" });

    const { stdout: aheadRaw } = await exec("git", ["rev-list", "--count", "@{upstream}..HEAD"], {
      cwd,
      encoding: "utf8",
    });
    const ahead = Number.parseInt(aheadRaw.trim(), 10);
    return Number.isFinite(ahead) && ahead === 0;
  } catch {
    return false;
  }
}
