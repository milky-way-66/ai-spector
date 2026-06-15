import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type ReviewActorRole = "user" | "client";

export interface ReviewActor {
  /** Actor email (git user.email when not explicitly provided). */
  by: string;
  /** Actor display name (git user.name when not explicitly provided). */
  username: string;
  role: ReviewActorRole;
}

/** Placeholder values agents/CLI use when identity should come from git. */
const GENERIC_BY = new Set(["user", "local", "unknown", "reviewer", "client"]);
const GENERIC_USERNAME = new Set(["user", "local", "unknown", "reviewer", "client"]);

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

async function isGitRepo(projectRoot: string): Promise<boolean> {
  try {
    await exec("git", ["rev-parse", "--git-dir"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

async function readGitConfig(
  projectRoot: string,
  key: "user.email" | "user.name",
): Promise<string | null> {
  if (!(await isGitRepo(projectRoot))) return null;

  for (const args of [[`config`, key], [`config`, `--global`, key]] as const) {
    try {
      const { stdout } = await exec("git", args, {
        cwd: projectRoot,
        encoding: "utf8",
      });
      const value = stdout.trim();
      if (value) return value;
    } catch {
      // Key unset at this scope — try next.
    }
  }
  return null;
}

/** Read `user.email` from repo-local git config, then global when inside a git repo. */
export async function getGitUserEmail(projectRoot: string): Promise<string | null> {
  return readGitConfig(projectRoot, "user.email");
}

/** Read `user.name` from repo-local git config, then global when inside a git repo. */
export async function getGitUserName(projectRoot: string): Promise<string | null> {
  return readGitConfig(projectRoot, "user.name");
}

function resolveEmail(raw: string | undefined, gitEmail: string | null): string {
  if (raw && looksLikeEmail(raw)) return raw;
  if (gitEmail && (!raw || GENERIC_BY.has(raw.toLowerCase()))) return gitEmail;
  if (raw && !GENERIC_BY.has(raw.toLowerCase())) return raw;
  return "unknown";
}

function resolveUsername(raw: string | undefined, gitUsername: string | null): string {
  if (raw && !GENERIC_USERNAME.has(raw.toLowerCase())) return raw;
  if (gitUsername && (!raw || GENERIC_USERNAME.has(raw.toLowerCase()))) return gitUsername;
  return "unknown";
}

/** Resolve review history/registry actor from git config unless explicitly overridden. */
export async function resolveReviewActor(
  projectRoot: string,
  opts: { by?: string; username?: string; role?: ReviewActorRole } = {},
): Promise<ReviewActor> {
  const role = opts.role ?? "user";
  const [gitEmail, gitUsername] = await Promise.all([
    getGitUserEmail(projectRoot),
    getGitUserName(projectRoot),
  ]);

  return {
    by: resolveEmail(opts.by?.trim(), gitEmail),
    username: resolveUsername(opts.username?.trim(), gitUsername),
    role,
  };
}
