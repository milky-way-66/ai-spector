import { readJson } from "../util/fs.js";
import {
  parseImpactRules,
  type ImpactRulesFile,
} from "ai-spector-graph";

export {
  computeImpact,
  mergeImpactResults,
  parseImpactRules,
  DEFAULT_IMPACT_RULES,
} from "ai-spector-graph";
export type { ImpactRulesFile, ImpactEntry, ImpactResult } from "ai-spector-graph";

export async function loadImpactRules(path: string): Promise<ImpactRulesFile> {
  return parseImpactRules(await readJson(path));
}
