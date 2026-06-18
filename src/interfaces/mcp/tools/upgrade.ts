import type { z } from "zod";
import { loadDocflowConfig } from "@/core/config/load.js";
import { runUpgradeApply } from "@/core/upgrade/apply.js";
import { runUpgradeScan } from "@/core/upgrade/scan.js";
import { markUpgradeSetupItem } from "@/core/upgrade/setup.js";
import { validateUpgrade } from "@/core/upgrade/validate.js";
import type {
  UpgradeApplySchema,
  UpgradeScanSchema,
  UpgradeSetupMarkSchema,
  UpgradeValidateSchema,
} from "../schemas.js";

async function resolveRoot(root?: string): Promise<string> {
  const loaded = await loadDocflowConfig(root);
  return loaded.root;
}

export async function toolUpgradeScan(input: z.infer<typeof UpgradeScanSchema>) {
  const root = await resolveRoot(input.root);
  return runUpgradeScan({ root, toVersion: input.target });
}

export async function toolUpgradeApply(input: z.infer<typeof UpgradeApplySchema>) {
  const root = await resolveRoot(input.root);
  return runUpgradeApply({
    root,
    auto: input.auto,
    items: input.items,
  });
}

export async function toolUpgradeValidate(input: z.infer<typeof UpgradeValidateSchema>) {
  const root = await resolveRoot(input.root);
  return validateUpgrade({ root });
}

export async function toolUpgradeSetupMark(input: z.infer<typeof UpgradeSetupMarkSchema>) {
  const root = await resolveRoot(input.root);
  return markUpgradeSetupItem(root, input.itemId);
}
