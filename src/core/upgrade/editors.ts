import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import type { UpgradeEditor } from "./types.js";

export async function detectEditors(root: string): Promise<UpgradeEditor[]> {
  const editors: UpgradeEditor[] = [];
  if (await pathExists(join(root, ".cursor/skills/ai-spector/SKILL.md"))) {
    editors.push("cursor");
  }
  if (
    (await pathExists(join(root, ".claude/skills/ai-spector/skill.md"))) ||
    (await pathExists(join(root, "CLAUDE.md")))
  ) {
    editors.push("claude");
  }
  return editors;
}
