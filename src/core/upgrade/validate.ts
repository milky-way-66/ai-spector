import { resolve } from "node:path";
import { runSetupCheck, type SetupAudit } from "../operations/setup.js";
import { filterApplicableItems, loadUpgradeChecklist } from "./checklist.js";
import { runUpgradeScan } from "./scan.js";
import { loadUpgradeSetup } from "./setup.js";
import { stampScaffoldVersion } from "./stamp.js";
import type { UpgradeScanResult, UpgradeSetupState } from "./types.js";

export async function validateUpgrade(opts: {
  root: string;
}): Promise<{
  ready: boolean;
  scan: UpgradeScanResult;
  setup: UpgradeSetupState;
  setupCheck: SetupAudit;
}> {
  const root = resolve(opts.root);
  const scan = await runUpgradeScan({ root });
  const setup = await loadUpgradeSetup(root);
  const checklist = loadUpgradeChecklist();
  const applicable = filterApplicableItems(checklist.items, {
    fromVersion: scan.fromVersion,
    toVersion: scan.toVersion,
    editors: scan.editors,
  });

  const requiredOpen = applicable.filter(
    (item) => item.severity === "required" && !setup.items[item.id]?.done,
  );
  const requiredGates = ["upgrade.confirmed", "upgrade.npm-installed"] as const;
  const gatesOpen = requiredGates.filter((gate) => !setup.items[gate]?.done);
  const ready = requiredOpen.length === 0 && gatesOpen.length === 0;

  if (ready) {
    await stampScaffoldVersion(root, scan.toVersion);
    const { completeUpgradeSession } = await import("./setup.js");
    await completeUpgradeSession(root);
  }

  const setupCheck = await runSetupCheck({ root });
  return {
    ready,
    scan,
    setup: await loadUpgradeSetup(root),
    setupCheck,
  };
}
