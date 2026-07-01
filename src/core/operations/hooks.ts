import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadDocflowConfig } from "../config/load.js";
import { validateGraph } from "./validate.js";
import { runCheck } from "./check.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { computeImpact, mergeImpactResults } from "../graph/impact.js";
import { loadImpactRules } from "../graph/impact-loader.js";
import { resolveFromGitDiff } from "../graph/resolve.js";
import { parseDocFilePath } from "../lang/paths.js";
import { loadPendingQueue, queuePaths } from "../lang/queue-store.js";
import { collectStagedFileNames, collectStagedGitDiff } from "../util/git-diff.js";
import { pathExists } from "../util/fs.js";
import { resolveProjectPaths } from "../util/paths.js";
import { HOOK_MARKER } from "./hooks-constants.js";

const exec = promisify(execFile);

export interface PreCommitOptions {
  root?: string;
  /** Treat warnings as errors (exit 1). */
  strict?: boolean;
  skipImpact?: boolean;
  skipQueue?: boolean;
  skipReview?: boolean;
}

export interface PreCommitReport {
  skipped: boolean;
  skipReason?: string;
  errors: string[];
  warnings: string[];
}

function isRelevantStagedPath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return (
    norm.startsWith("docs/srs/") ||
    norm.startsWith("docs/basic-design/") ||
    norm.startsWith("docs/detail-design/") ||
    norm.startsWith(".ai-spector/graph/")
  );
}

function jobTouchesStagedDoc(
  job: { docType: string; relativePath: string },
  stagedDocs: Array<{ docType: string; relativePath: string }>,
): boolean {
  return stagedDocs.some(
    (d) => d.docType === job.docType && d.relativePath === job.relativePath,
  );
}

export async function runPreCommitCheck(opts: PreCommitOptions = {}): Promise<PreCommitReport> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let root: string;
  try {
    ({ root } = await loadDocflowConfig(opts.root));
  } catch {
    return { skipped: true, skipReason: "not an ai-spector project", errors, warnings };
  }

  const staged = await collectStagedFileNames(root);
  const relevant = staged.filter(isRelevantStagedPath);
  if (relevant.length === 0) {
    return { skipped: true, skipReason: "no staged doc or graph files", errors, warnings };
  }

  // Workspace structural check — blocks commit on error-severity findings.
  try {
    const check = await runCheck({ root });
    for (const f of check.findings.filter((x) => x.severity === "error")) {
      errors.push(`Workspace check [${f.ruleId}]: ${f.message}`);
      if (f.fix) errors.push(`  Fix: ${f.fix}`);
    }
  } catch (err) {
    warnings.push(
      `Workspace check failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const paths = await resolveProjectPaths(root);
  const graphExists = await pathExists(paths.graph);

  if (graphExists) {
    const issues = await validateGraph({
      graphPath: paths.graph,
      schemaPath: paths.schema,
      registryPath: paths.registry,
      rulesPath: paths.rulesTraceability,
    });
    const graphErrors = issues.filter((i) => i.severity === "error");
    if (graphErrors.length > 0) {
      errors.push(
        `Graph validate failed (${graphErrors.length} error(s)). Fix before commit:`,
        ...graphErrors.slice(0, 8).map((i) => `  - [${i.ruleId}] ${i.message}`),
      );
      if (graphErrors.length > 8) {
        errors.push(`  … and ${graphErrors.length - 8} more`);
      }
      errors.push("  Run: npx ai-spector graph validate");
    }
  } else if (relevant.some((p) => p.startsWith(".ai-spector/graph/"))) {
    warnings.push("Staged graph files but traceability graph not found at expected path.");
  }

  const stagedDocs = relevant
    .map((p) => parseDocFilePath(p))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (!opts.skipQueue && stagedDocs.length > 0 && paths.config.languages.length >= 2) {
    try {
      const queue = queuePaths(root);
      const pending = await loadPendingQueue(queue);
      const related = pending.jobs.filter((j) => jobTouchesStagedDoc(j, stagedDocs));
      if (related.length > 0) {
        warnings.push(
          `${related.length} pending translation job(s) for staged document(s):`,
          ...related.map(
            (j) =>
              `  - ${j.docType}/${j.relativePath} (${j.direction}, origin: ${j.origin.lang}, pending: ${j.targets.filter((t) => t.status === "pending").map((t) => t.lang).join(", ") || "none"})`,
          ),
        );
        warnings.push(
          "  Sync translations before commit, or defer and run: npx ai-spector-resolve-translation",
        );
        warnings.push(
          "  Merge context: .ai-spector/.docflow/translation-queue/changes/",
        );
        warnings.push(
          "  After syncing targets run: npx ai-spector index",
        );
      }
    } catch (err) {
      warnings.push(
        `Translation queue check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (!opts.skipReview && stagedDocs.length > 0) {
    try {
      const { readDocopsConfig } = await import("../docops/config.js");
      const { runReviewCheck } = await import("./review.js");
      const docops = await readDocopsConfig(root);
      if (docops?.capabilities?.review) {
        const reviewResult = await runReviewCheck({ root });
        if (reviewResult.invalidated > 0) {
          warnings.push(
            `${reviewResult.invalidated} internal approval(s) invalidated (content changed) — re-review required.`,
          );
          warnings.push(
            "  Stage updated review-queue files (`.docops/review-queue/` or legacy path) before commit.",
          );
        }
        if (reviewResult.queued > 0) {
          warnings.push(
            `${reviewResult.queued} document(s) newly queued for internal review.`,
          );
        }
        warnings.push("  Run: npx ai-spector lifecycle sync --json (updates review-queue-synced step).");
      }
    } catch (err) {
      warnings.push(
        `Review queue check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (!opts.skipImpact && graphExists && relevant.some((p) => p.startsWith("docs/"))) {
    try {
      const stagedDiff = await collectStagedGitDiff(root);
      if (!stagedDiff.empty) {
        const g = await loadInMemoryGraph(paths.graph);
        const origins = resolveFromGitDiff(g, stagedDiff.diff);
        if (origins.length > 0) {
          const rules = await loadImpactRules(paths.rulesImpact);
          const results = origins.map((origin) =>
            computeImpact(g, origin.id, "content_change", rules),
          );
          const merged = mergeImpactResults(results);
          const regen = merged.regenerate.length;
          const review = merged.review.length;
          if (regen > 0 || review > 0) {
            warnings.push(
              `Graph impact: ${regen} regenerate, ${review} review downstream of staged doc edits.`,
            );
            warnings.push("  Run: npx ai-spector graph impact --git --change content_change");
          }
        }
      }
    } catch (err) {
      warnings.push(
        `Impact check skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { skipped: false, errors, warnings };
}

export function formatPreCommitReport(report: PreCommitReport): string {
  if (report.skipped) {
    return "";
  }
  const lines: string[] = ["ai-spector pre-commit check", ""];
  if (report.errors.length > 0) {
    lines.push("ERRORS (commit blocked):", ...report.errors, "");
  }
  if (report.warnings.length > 0) {
    lines.push("WARNINGS:", ...report.warnings, "");
  }
  if (report.errors.length === 0 && report.warnings.length === 0) {
    lines.push("OK — no issues found for staged doc/graph changes.");
  }
  return lines.join("\n");
}

export async function runHooksPreCommit(opts: PreCommitOptions = {}): Promise<PreCommitReport> {
  return runPreCommitCheck(opts);
}

export interface CiGateOptions {
  root?: string;
  json?: boolean;
  skipReview?: boolean;
}

export interface CiGateReport {
  ok: boolean;
  skipped: boolean;
  skipReason?: string;
  reviewCheck?: Awaited<ReturnType<typeof import("./review.js").runReviewCheck>>;
  lifecycleSynced: boolean;
  errors: string[];
  warnings: string[];
}

/** CI pipeline gate: review queue staleness + lifecycle reconcile. */
export async function runHooksCi(opts: CiGateOptions = {}): Promise<CiGateReport> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let root: string;
  try {
    ({ root } = await loadDocflowConfig(opts.root));
  } catch {
    return {
      ok: true,
      skipped: true,
      skipReason: "not an ai-spector project",
      lifecycleSynced: false,
      errors,
      warnings,
    };
  }

  let reviewCheck: CiGateReport["reviewCheck"];
  if (!opts.skipReview) {
    try {
      const { readDocopsConfig } = await import("../docops/config.js");
      const { runReviewCheck } = await import("./review.js");
      const docops = await readDocopsConfig(root);
      if (docops?.capabilities?.review) {
        reviewCheck = await runReviewCheck({ root });
        if (reviewCheck.invalidated > 0) {
          warnings.push(
            `${reviewCheck.invalidated} internal approval(s) invalidated (content changed).`,
          );
        }
      }
    } catch (err) {
      errors.push(
        `Review check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  let lifecycleSynced = false;
  try {
    const { runLifecycleSync } = await import("./lifecycle.js");
    const code = await runLifecycleSync({ root, json: Boolean(opts.json) });
    lifecycleSynced = code === 0;
    if (code !== 0) {
      errors.push("Lifecycle sync failed.");
    }
  } catch (err) {
    errors.push(
      `Lifecycle sync failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    reviewCheck,
    lifecycleSynced,
    errors,
    warnings,
  };
}

export function formatCiGateReport(report: CiGateReport): string {
  if (report.skipped) {
    return report.skipReason ? `ai-spector ci: skipped (${report.skipReason})` : "";
  }
  const lines: string[] = ["ai-spector ci gate", ""];
  if (report.reviewCheck) {
    const r = report.reviewCheck;
    lines.push(
      `Review check: scanned=${r.scanned} invalidated=${r.invalidated} queued=${r.queued}`,
    );
    lines.push("");
  }
  if (report.errors.length > 0) {
    lines.push("ERRORS:", ...report.errors, "");
  }
  if (report.warnings.length > 0) {
    lines.push("WARNINGS:", ...report.warnings, "");
  }
  if (report.ok) {
    lines.push("OK — review queue and lifecycle reconciled.");
  }
  return lines.join("\n");
}

const PRE_COMMIT_HOOK = `#!/bin/sh
# Installed by npx ai-spector hooks install (${HOOK_MARKER})
set -e
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 1
npx ai-spector hooks pre-commit "$@"
GIT_DIR="$(git rev-parse --absolute-git-dir)"
if [ -f "$GIT_DIR/hooks/pre-commit.local" ]; then
  exec "$GIT_DIR/hooks/pre-commit.local" "$@"
fi
`;

export async function isGitRepository(projectRoot: string): Promise<boolean> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: projectRoot,
    });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/** Create a git repo in projectRoot when missing. Returns true if `git init` was run. */
export async function ensureGitRepository(projectRoot: string): Promise<boolean> {
  if (await isGitRepository(projectRoot)) {
    return false;
  }
  await exec("git", ["init"], { cwd: projectRoot });
  return true;
}

export async function installGitHooks(projectRoot: string): Promise<string> {
  if (!(await isGitRepository(projectRoot))) {
    throw new Error("Not a git repository — run git init first, then npx ai-spector hooks install");
  }

  const { stdout: gitDirRaw } = await exec("git", ["rev-parse", "--absolute-git-dir"], {
    cwd: projectRoot,
  });
  const gitDir = gitDirRaw.trim();
  const hookPath = join(gitDir, "hooks", "pre-commit");
  const localPath = join(gitDir, "hooks", "pre-commit.local");

  if (await pathExists(hookPath)) {
    const existing = await readFile(hookPath, "utf8");
    if (existing.includes(HOOK_MARKER)) {
      await writeFile(hookPath, PRE_COMMIT_HOOK, "utf8");
      await chmod(hookPath, 0o755);
      return hookPath;
    }
    if (!(await pathExists(localPath))) {
      await rename(hookPath, localPath);
    }
  }

  await writeFile(hookPath, PRE_COMMIT_HOOK, "utf8");
  await chmod(hookPath, 0o755);
  return hookPath;
}

export interface HooksInstallResult {
  hookPath: string;
  gitInitialized: boolean;
}

export async function runHooksInstall(opts: { root?: string } = {}): Promise<HooksInstallResult> {
  const { root } = await loadDocflowConfig(opts.root);
  const gitInitialized = await ensureGitRepository(root);
  const hookPath = await installGitHooks(root);
  return { hookPath, gitInitialized };
}
