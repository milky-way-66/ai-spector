import { join } from "node:path";
import { pathExists } from "../util/fs.js";
import { logicalPathToDocPath } from "../comments/paths.js";
import { loadOrDeriveDocopsConfig } from "../docops/config.js";
import { segmentRepoPrefixMap } from "../docops/paths.js";
import {
  loadDocflowConfig,
  preferredLanguageCode,
  primaryLanguage,
} from "../config/load.js";
import type { ReviewTrack } from "./types.js";

export interface ResolveReviewDocPathOptions {
  /** Which review track is resolving the document — affects language preference. */
  track?: ReviewTrack;
}

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
 *   2. Preferred-language subfolder (internalLanguage for internal, clientLanguage for client track)
 *   3. Primary-language subfolder (when preferred differs from primary)
 *   4. Any other configured language subfolder (first match)
 *
 * Throws a descriptive error if none exist.
 */
export async function resolveReviewDocPath(
  projectRoot: string,
  logicalPath: string,
  options: ResolveReviewDocPathOptions = {},
): Promise<ResolvedDocPath> {
  let repoPrefixBySegment: Record<string, string> | undefined;
  try {
    const docops = await loadOrDeriveDocopsConfig(projectRoot);
    repoPrefixBySegment = segmentRepoPrefixMap(docops);
  } catch {
    repoPrefixBySegment = undefined;
  }

  const flatRel = logicalPathToDocPath(logicalPath, repoPrefixBySegment);
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
  const slash = flatRel.lastIndexOf("/");
  const folderPrefix = slash >= 0 ? flatRel.slice(0, slash + 1) : "";
  const fileName = slash >= 0 ? flatRel.slice(slash + 1) : flatRel;
  const track = options.track ?? "internal";
  const preferredLang = preferredLanguageCode(config, track);
  const primaryLang = primaryLanguage(config).code;

  const tryLangFolder = async (langCode: string): Promise<ResolvedDocPath | null> => {
    if (!folderPrefix || !fileName) return null;
    const langRel = `${folderPrefix}${langCode}/${fileName}`;
    if (tried.includes(langRel)) return null;
    tried.push(langRel);
    const langAbs = join(projectRoot, langRel);
    if (await pathExists(langAbs)) {
      return { docPath: langRel, absPath: langAbs };
    }
    return null;
  };

  // 2. Preferred language for this track
  const preferred = await tryLangFolder(preferredLang);
  if (preferred) return preferred;

  // 3. Primary language (when preferred differs, e.g. client prefers vi but en is primary)
  if (preferredLang !== primaryLang) {
    const primary = await tryLangFolder(primaryLang);
    if (primary) return primary;
  }

  // 4. Fallback: any other configured language subfolder
  if (folderPrefix && fileName) {
    for (const lang of config.languages) {
      if (lang.code === preferredLang || lang.code === primaryLang) continue;
      const match = await tryLangFolder(lang.code);
      if (match) return match;
    }
  }

  throw new Error(
    `Document not found for logical path "${logicalPath}". ` +
      `Tried: ${tried.join(", ")}. ` +
      `Preferred language is "${preferredLang}" (track: ${track}) — ensure the document exists or add the language to docflow.config.json.`,
  );
}
