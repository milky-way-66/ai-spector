import { execFile } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { adoptArtifactPaths } from "./paths.js";
import { markAdoptSetupItem } from "./setup.js";
import type { AdoptPlan } from "./types.js";

const exec = promisify(execFile);

type MovePair = { from: string; to: string };

type HistoryEntry =
  | { at: string; action: "move"; from: string; to: string }
  | { at: string; action: "error"; message: string; from?: string; to?: string };

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/\/+$/, "");
}

function collectMoves(plan: AdoptPlan): MovePair[] {
  const moves = plan.moves.map((move) => ({
    from: normalizePath(move.from),
    to: normalizePath(move.to),
  }));

  for (const action of plan.prototypeActions) {
    if (action.action !== "relocate" || !action.from || !action.to) {
      continue;
    }
    const from = normalizePath(action.from);
    const to = normalizePath(action.to);
    const alreadyCovered = moves.some(
      (move) =>
        normalizePath(move.from) === from ||
        normalizePath(move.from).startsWith(`${from}/`),
    );
    if (!alreadyCovered) {
      moves.push({ from, to });
    }
  }

  return moves;
}

async function isGitRepo(root: string): Promise<boolean> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: root,
    });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function appendHistory(historyPath: string, entry: HistoryEntry): Promise<void> {
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify(entry)}\n`, { flag: "a" });
}

async function performMove(
  root: string,
  move: MovePair,
  useGit: boolean,
): Promise<void> {
  const absFrom = join(root, move.from);
  const absTo = join(root, move.to);
  await mkdir(dirname(absTo), { recursive: true });
  if (useGit) {
    await exec("git", ["mv", move.from, move.to], { cwd: root });
  } else {
    await rename(absFrom, absTo);
  }
}

async function rollbackMoves(
  root: string,
  completed: MovePair[],
  useGit: boolean,
): Promise<void> {
  for (const move of [...completed].reverse()) {
    const reverse = { from: move.to, to: move.from };
    await performMove(root, reverse, useGit);
  }
}

export async function runAdoptApply(opts: {
  root?: string;
  dryRun?: boolean;
} = {}): Promise<{
  moved: number;
  dryRun: boolean;
  moves: Array<{ from: string; to: string }>;
}> {
  const { root } = await loadDocflowConfig(opts.root);
  const paths = adoptArtifactPaths(root);

  if (!(await pathExists(paths.plan))) {
    throw new Error("No adopt plan — run: npx ai-spector adopt plan");
  }

  const plan = await readJson<AdoptPlan>(paths.plan);
  if (plan.status !== "approved") {
    throw new Error(`Plan must be approved before apply — current status: ${plan.status}`);
  }

  const moves = collectMoves(plan);
  const dryRun = opts.dryRun ?? false;

  if (dryRun) {
    return { moved: 0, dryRun: true, moves };
  }

  const useGit = await isGitRepo(root);
  const completed: MovePair[] = [];

  try {
    for (const move of moves) {
      await performMove(root, move, useGit);
      completed.push(move);
      await appendHistory(paths.history, {
        at: new Date().toISOString(),
        action: "move",
        from: move.from,
        to: move.to,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedMove = moves[completed.length];
    try {
      await rollbackMoves(root, completed, useGit);
    } catch {
      // Best-effort rollback; original error takes precedence.
    }
    await appendHistory(paths.history, {
      at: new Date().toISOString(),
      action: "error",
      message,
      ...(failedMove ? { from: failedMove.from, to: failedMove.to } : {}),
    });
    throw error;
  }

  const applied: AdoptPlan = { ...plan, status: "applied" };
  await writeJson(paths.plan, applied);
  await markAdoptSetupItem(root, "apply.done");

  return { moved: moves.length, dryRun: false, moves };
}
