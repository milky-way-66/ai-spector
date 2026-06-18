import { resolve } from "node:path";
import type { Command } from "commander";
import { loadDocflowConfig } from "../config/load.js";
import { runUpgradeApply } from "../upgrade/apply.js";
import { runUpgradeScan } from "../upgrade/scan.js";
import { loadUpgradeSetup, markUpgradeSetupItem } from "../upgrade/setup.js";
import { readScaffoldVersion } from "../upgrade/stamp.js";
import { validateUpgrade } from "../upgrade/validate.js";
import { installedPackageVersion } from "../upgrade/package-version.js";
import {
  formatUpgradeApply,
  formatUpgradeScan,
  formatUpgradeSetupMark,
  formatUpgradeStatus,
  formatUpgradeValidate,
} from "../../interfaces/cli/format/upgrade.js";

export { runUpgradeScan } from "../upgrade/scan.js";
export { runUpgradeApply } from "../upgrade/apply.js";
export { validateUpgrade } from "../upgrade/validate.js";
export { markUpgradeSetupItem, loadUpgradeSetup } from "../upgrade/setup.js";

async function projectRoot(cwd?: string): Promise<string> {
  const { root } = await loadDocflowConfig(cwd ? resolve(cwd) : undefined);
  return root;
}

export function registerUpgradeCommand(program: Command): void {
  const upgrade = program
    .command("upgrade")
    .description("Scan, apply, and validate ai-spector package upgrades");

  upgrade
    .command("scan")
    .description("Detect stale scaffold, config drift, and applicable checklist items")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--target <version>", "Target package version (default: installed)")
    .option("--strict", "Exit 1 when required findings remain")
    .option("--json", "JSON output")
    .action(async (opts: { cwd?: string; target?: string; strict?: boolean; json?: boolean }) => {
      const root = await projectRoot(opts.cwd);
      const result = await runUpgradeScan({ root, toVersion: opts.target });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatUpgradeScan(result));
      }
      if (opts.strict && !result.ready) {
        process.exitCode = 1;
      }
    });

  upgrade
    .command("apply")
    .description("Apply auto-fixable upgrade checklist items")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--auto", "Apply all auto-fixable items (default)", true)
    .option("--no-auto", "Disable auto apply")
    .option("--items <ids>", "Comma-separated checklist item IDs")
    .option("--json", "JSON output")
    .action(async (opts: { cwd?: string; auto?: boolean; items?: string; json?: boolean }) => {
      const root = await projectRoot(opts.cwd);
      const items = opts.items?.split(",").map((s) => s.trim()).filter(Boolean);
      const result = await runUpgradeApply({
        root,
        auto: opts.auto,
        items,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatUpgradeApply(result));
      if (result.failed.length > 0) {
        process.exitCode = 1;
      }
    });

  upgrade
    .command("validate")
    .description("Verify upgrade checklist complete and stamp scaffoldVersion")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (opts: { cwd?: string; json?: boolean }) => {
      const root = await projectRoot(opts.cwd);
      const result = await validateUpgrade({ root });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = result.ready ? 0 : 1;
        return;
      }
      console.log(formatUpgradeValidate(result));
      process.exitCode = result.ready ? 0 : 1;
    });

  upgrade
    .command("status")
    .description("Show upgrade session progress and version comparison")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (opts: { cwd?: string; json?: boolean }) => {
      const root = await projectRoot(opts.cwd);
      const setup = await loadUpgradeSetup(root);
      const scaffoldVersion = await readScaffoldVersion(root);
      const packageVersion = installedPackageVersion();
      if (opts.json) {
        console.log(
          JSON.stringify({ setup, scaffoldVersion, packageVersion }, null, 2),
        );
        return;
      }
      console.log(formatUpgradeStatus(setup, scaffoldVersion, packageVersion));
    });

  upgrade
    .command("setup-mark <item-id>")
    .description("Mark a human-confirmed upgrade item done (e.g. UPG-030, upgrade.confirmed)")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--json", "JSON output")
    .action(async (itemId: string, opts: { cwd?: string; json?: boolean }) => {
      const root = await projectRoot(opts.cwd);
      const result = await markUpgradeSetupItem(root, itemId);
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatUpgradeSetupMark(itemId, result));
    });
}
