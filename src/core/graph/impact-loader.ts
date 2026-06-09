import { readJson } from "../util/fs.js";
import { parseImpactRules } from "./impact.js";
import type { ImpactRulesFile } from "./impact.js";

export type { ImpactRulesFile };

export async function loadImpactRules(path: string): Promise<ImpactRulesFile> {
  return parseImpactRules(await readJson(path));
}
