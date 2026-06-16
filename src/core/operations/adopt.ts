import { resolve } from "node:path";
import type { Command } from "commander";
import { loadDocflowConfig } from "../config/load.js";
import { runAdoptApply } from "../adopt/apply.js";
import { runAdoptBootstrap } from "../adopt/bootstrap.js";
import { runAdoptPlan, approveAdoptPlan } from "../adopt/plan.js";
import { runAdoptScan } from "../adopt/scan.js";
import { markAdoptSetupItem, recordAdoptAnswer } from "../adopt/setup.js";
import { validateAdopt } from "../adopt/validate.js";
import {
  formatAdoptApply,
  formatAdoptBootstrap,
  formatAdoptContextRecord,
  formatAdoptPlan,
  formatAdoptScan,
  formatAdoptSetupMark,
  formatAdoptValidate,
} from "../../interfaces/cli/format/adopt.js";

export { runAdoptScan } from "../adopt/scan.js";
export { runAdoptPlan, approveAdoptPlan } from "../adopt/plan.js";
export { runAdoptApply } from "../adopt/apply.js";
export { runAdoptBootstrap } from "../adopt/bootstrap.js";
export { validateAdopt } from "../adopt/validate.js";
export { markAdoptSetupItem, recordAdoptAnswer } from "../adopt/setup.js";
export type {
  AdoptScanResult,
  AdoptPlan,
  AdoptSetupState,
  AdoptQuestion,
  AdoptInventoryItem,
} from "../adopt/types.js";
export type { AdoptValidationResult, AdoptValidationGap } from "../adopt/validate.js";

async function projectRoot(cwd?: string): Promise<string> {
  const { root } = await loadDocflowConfig(cwd ? resolve(cwd) : undefined);
  return root;
}

export function registerAdoptCommand(program: Command): void {
  const adopt = program
    .command("adopt")
    .description("Migrate existing docs to canonical AI Spector layout");

  adopt
    .command("scan")
    .description("Classify project layout and inventory existing docs")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (opts: { cwd?: string; json?: boolean }) => {
      const result = await runAdoptScan({ root: resolve(opts.cwd ?? process.cwd()) });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatAdoptScan(result));
    });

  adopt
    .command("plan")
    .description("Build migration plan from scan result and stored answers")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .option("--approve", "Approve plan after generation (Gate 2)")
    .option("--by <email>", "Approver identity when using --approve")
    .option("--sync", "Refresh heuristics from scan (overwrite draft plan)")
    .action(async (opts: { cwd?: string; json?: boolean; approve?: boolean; by?: string; sync?: boolean }) => {
      const root = resolve(opts.cwd ?? process.cwd());
      let result = await runAdoptPlan({ root, sync: opts.sync });
      if (opts.approve) {
        result = await approveAdoptPlan({ root, by: opts.by });
      }
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatAdoptPlan(result));
    });

  adopt
    .command("apply")
    .description("Execute approved migration plan (git mv when in a git repo)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--dry-run", "Preview moves without changing files")
    .option("--json", "JSON output")
    .action(async (opts: { cwd?: string; dryRun?: boolean; json?: boolean }) => {
      const result = await runAdoptApply({
        root: resolve(opts.cwd ?? process.cwd()),
        dryRun: opts.dryRun,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatAdoptApply(result));
    });

  adopt
    .command("bootstrap")
    .description("Post-move index, analyze, prototype, review registry, and adopt tasks")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .option("--skip-analyze", "Skip optional analyze step")
    .action(async (opts: { cwd?: string; json?: boolean; skipAnalyze?: boolean }) => {
      const result = await runAdoptBootstrap({
        root: resolve(opts.cwd ?? process.cwd()),
        skipAnalyze: opts.skipAnalyze,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatAdoptBootstrap(result));
    });

  adopt
    .command("validate")
    .description("Readiness gate — workspace + graph checks after migration")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .option("--sync", "Update adopt-setup.json from plan status")
    .action(async (opts: { cwd?: string; json?: boolean; sync?: boolean }) => {
      const result = await validateAdopt({
        root: resolve(opts.cwd ?? process.cwd()),
        sync: opts.sync,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = result.ready ? 0 : 1;
        return;
      }
      console.log(formatAdoptValidate(result));
      process.exitCode = result.ready ? 0 : 1;
    });

  adopt
    .command("setup-mark <item-id>")
    .description("Mark a human-confirmed adopt setup item done (e.g. migration.complete)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (itemId: string, opts: { cwd?: string; json?: boolean }) => {
      const root = await projectRoot(opts.cwd);
      const result = await markAdoptSetupItem(root, itemId);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatAdoptSetupMark(itemId, result));
    });

  adopt
    .command("context-record <id> <answer>")
    .description("Record Gate 1 answer in adopt context.json")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (id: string, answer: string, opts: { cwd?: string; json?: boolean }) => {
      const root = await projectRoot(opts.cwd);
      await recordAdoptAnswer(root, id, answer);
      if (opts.json) {
        console.log(JSON.stringify({ id, answer }, null, 2));
        return;
      }
      console.log(formatAdoptContextRecord(id, answer));
    });
}
