import { join } from "node:path";

export interface ScreenDocPathResult {
  /** Language-neutral doc path without the `docs/` prefix or language segment. */
  screenDocPath: string;
  /** Per-language repo-relative paths when the project has multiple doc languages. */
  screenDocs?: Record<string, string>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip `docs/` and an optional configured language segment from a detail directory. */
export function toLangNeutralDocDir(detailDir: string, docLanguages: string[]): string {
  let normalized = detailDir.replace(/\\/g, "/").replace(/\/$/, "").replace(/^docs\/?/, "");
  if (docLanguages.length > 1) {
    const escaped = docLanguages.map(escapeRegExp).join("|");
    normalized = normalized.replace(new RegExp(`/(${escaped})(/|$)`), "$2").replace(/\/$/, "");
  }
  return normalized;
}

function fullPathForLanguage(
  logicalPath: string,
  lang: string,
  docLanguages: string[],
): string {
  if (docLanguages.length <= 1) {
    return `docs/${logicalPath}`.replace(/\\/g, "/");
  }
  const slash = logicalPath.indexOf("/");
  const domain = slash >= 0 ? logicalPath.slice(0, slash) : logicalPath;
  const rest = slash >= 0 ? logicalPath.slice(slash + 1) : "";
  return rest
    ? `docs/${domain}/${lang}/${rest}`.replace(/\\/g, "/")
    : `docs/${domain}/${lang}/${logicalPath}`.replace(/\\/g, "/");
}

/** Build logical path + per-language repo-relative paths for screen-map entries. */
export function buildScreenDocPaths(opts: {
  screenDetailDir: string;
  docFilename: string;
  docLanguages: string[];
}): ScreenDocPathResult {
  const langNeutralDir = toLangNeutralDocDir(opts.screenDetailDir, opts.docLanguages);
  const logicalPath = join(langNeutralDir, opts.docFilename).replace(/\\/g, "/");

  if (opts.docLanguages.length > 1) {
    const screenDocs = Object.fromEntries(
      opts.docLanguages.map((lang) => [
        lang,
        fullPathForLanguage(logicalPath, lang, opts.docLanguages),
      ]),
    );
    return { screenDocPath: logicalPath, screenDocs };
  }

  return { screenDocPath: logicalPath };
}
