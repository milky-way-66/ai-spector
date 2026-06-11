import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { logicalPathToDocPath } from "../comments/paths.js";
import { loadDocflowConfig, primaryLanguage } from "../config/load.js";

export interface ResolvedDocPath {
  /** Repo-relative path to the document file. */
  docPath: string;
  /** Absolute path. */
  absPath: string;
}

/**
 * Resolve the on-disk path for a logical document path.
 *
 * Tries in order:
 *   1. Flat path: `docs/srs/1-introduction.md`
 *   2. Primary-language subfolder: `docs/srs/{primaryLang}/1-introduction.md`
 *   3. Any configured language subfolder (first match)
 *
 * Throws a descriptive error if none exist.
 */
export async function resolveReviewDocPath(
  projectRoot: string,
  logicalPath: string,
): Promise<ResolvedDocPath> {
  const flatRel = logicalPathToDocPath(logicalPath);
  if (!flatRel) {
    throw new Error(`Cannot resolve doc path for logical path: ${logicalPath}`);
  }

  // 1. Flat path (single-language or English projects)
  const flatAbs = join(projectRoot, flatRel);
  if (await pathExists(flatAbs)) {
    return { docPath: flatRel, absPath: flatAbs };
  }

  let config;
  try {
    ({ config } = await loadDocflowConfig(projectRoot));
  } catch {
    throw new Error(
      `Document not found: ${flatRel}. ` +
        `Could not load docflow.config.json to try language subfolders.`,
    );
  }

  const tried: string[] = [flatRel];
  const prefixMatch = flatRel.match(/^(docs\/[^/]+\/)/);

  // 2. Primary-language subfolder
  const primaryLang = primaryLanguage(config).code;
  if (prefixMatch) {
    const langRel = flatRel.replace(prefixMatch[0], `${prefixMatch[0]}${primaryLang}/`);
    tried.push(langRel);
    const langAbs = join(projectRoot, langRel);
    if (await pathExists(langAbs)) {
      return { docPath: langRel, absPath: langAbs };
    }
  }

  // 3. Fallback: any configured language subfolder
  if (prefixMatch) {
    for (const lang of config.languages) {
      if (lang.code === primaryLang) continue;
      const langRel = flatRel.replace(prefixMatch[0], `${prefixMatch[0]}${lang.code}/`);
      if (tried.includes(langRel)) continue;
      tried.push(langRel);
      const langAbs = join(projectRoot, langRel);
      if (await pathExists(langAbs)) {
        return { docPath: langRel, absPath: langAbs };
      }
    }
  }

  throw new Error(
    `Document not found for logical path "${logicalPath}". ` +
      `Tried: ${tried.join(", ")}. ` +
      `Primary language is "${primaryLang}" — ensure the document exists or add the language to docflow.config.json.`,
  );
}
