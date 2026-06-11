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
 *
 * Throws a descriptive error if neither exists.
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

  // 2. Primary-language subfolder (multilingual projects)
  let langCode: string;
  try {
    const { config } = await loadDocflowConfig(projectRoot);
    langCode = primaryLanguage(config).code;
  } catch {
    // If config cannot be loaded fall through to error below
    throw new Error(
      `Document not found: ${flatRel}. ` +
        `Could not load docflow.config.json to try language subfolders.`,
    );
  }

  // Insert lang between the `docs/<section>/` prefix and the chapter name.
  // flatRel: "docs/srs/1-introduction.md"  →  "docs/srs/vi/1-introduction.md"
  const langRel = flatRel.replace(/^(docs\/[^/]+\/)/, `$1${langCode}/`);
  const langAbs = join(projectRoot, langRel);
  if (await pathExists(langAbs)) {
    return { docPath: langRel, absPath: langAbs };
  }

  throw new Error(
    `Document not found: ${flatRel}. ` +
      `Also tried language subfolder: ${langRel} (primary language: ${langCode}). ` +
      `Ensure the document exists at one of these paths or update the primary language in docflow.config.json.`,
  );
}
