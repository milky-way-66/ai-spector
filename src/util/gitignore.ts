import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "./fs.js";

export const GITIGNORE_BEGIN = "# >>> ai-spector (begin)";
export const GITIGNORE_END = "# <<< ai-spector (end)";

/** Lines merged into the project root .gitignore on init. */
export const AI_SPECTOR_GITIGNORE_LINES = [
  GITIGNORE_BEGIN,
  "# Graphify MCP + local reports (see .cursor/mcp.json)",
  "docs/data-source/graphify-out/",
  ".ai-spector/.docflow/graph/graphify-index/",
  ".ai-spector/.docflow/graph/graphify-out/",
  ".ai-spector/views/",
  GITIGNORE_END,
  "",
] as const;

function buildBlock(): string {
  return `${AI_SPECTOR_GITIGNORE_LINES.join("\n")}`;
}

function replaceOrAppendBlock(existing: string, block: string): string {
  const begin = existing.indexOf(GITIGNORE_BEGIN);
  const end = existing.indexOf(GITIGNORE_END);

  if (begin !== -1 && end !== -1 && end > begin) {
    const before = existing.slice(0, begin);
    const after = existing.slice(end + GITIGNORE_END.length);
    return `${before}${block}${after.replace(/^\n/, "")}`;
  }

  const trimmed = existing.replace(/\s*$/, "");
  const separator = trimmed.length > 0 ? "\n\n" : "";
  return `${trimmed}${separator}${block}`;
}

/**
 * Ensure project root `.gitignore` includes the ai-spector block.
 */
export async function ensureAiSpectorGitignore(projectRoot: string): Promise<string> {
  const gitignorePath = join(projectRoot, ".gitignore");
  const block = buildBlock();

  let existing = "";
  if (await pathExists(gitignorePath)) {
    existing = await readFile(gitignorePath, "utf8");
  }

  const next = replaceOrAppendBlock(existing, block);
  if (next !== existing) {
    await writeFile(gitignorePath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  }

  return gitignorePath;
}
