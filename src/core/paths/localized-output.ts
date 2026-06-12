const BUILTIN_DOC_PREFIX = /^docs\/(srs|basic-design)\//i;
const LOCALE_SEGMENT = /^docs\/(srs|basic-design)\/([a-z]{2,5}(?:-[a-zA-Z]{2,4})?)\//i;

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** True when path is under docs/srs/ or docs/basic-design/ with a BCP-47 lang folder. */
export function hasLocaleSegment(relativePath: string): boolean {
  return LOCALE_SEGMENT.test(normalizePath(relativePath));
}

/** Insert the primary language folder into builtin SRS/BD paths that lack a locale segment. */
export function localizedOutputForPrimary(
  relativePath: string,
  primaryLangCode: string,
): string {
  const norm = normalizePath(relativePath);
  if (!BUILTIN_DOC_PREFIX.test(norm) || hasLocaleSegment(norm)) {
    return norm;
  }
  return norm
    .replace(/^docs\/srs\//i, `docs/srs/${primaryLangCode}/`)
    .replace(/^docs\/basic-design\//i, `docs/basic-design/${primaryLangCode}/`);
}

/** Map a primary (or unlocalized) builtin output path to a target language folder. */
export function localizedOutputForLang(
  relativePath: string,
  langCode: string,
  primaryLangCode?: string,
): string {
  const norm = normalizePath(relativePath);
  if (primaryLangCode) {
    const primaryPrefix = new RegExp(
      `^docs/(srs|basic-design)/${escapeRegExp(primaryLangCode)}/`,
      "i",
    );
    const swapped = norm.replace(primaryPrefix, `docs/$1/${langCode}/`);
    if (swapped !== norm) {
      return swapped;
    }
  }
  if (!BUILTIN_DOC_PREFIX.test(norm) || hasLocaleSegment(norm)) {
    return norm;
  }
  return norm
    .replace(/^docs\/srs\//i, `docs/srs/${langCode}/`)
    .replace(/^docs\/basic-design\//i, `docs/basic-design/${langCode}/`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builtin SRS/BD doc is misplaced when the first path segment after the doc type
 * is not one of the configured language codes (e.g. docs/srs/3-use-cases.md).
 */
export function isMisplacedBuiltinDocPath(
  relativePath: string,
  configuredLangCodes: string[],
): boolean {
  const norm = normalizePath(relativePath);
  const m = norm.match(/^docs\/(srs|basic-design)\/(.+)$/i);
  if (!m) {
    return false;
  }
  const firstSegment = m[2]!.split("/")[0]!;
  return !configuredLangCodes.includes(firstSegment);
}

/** Suggest moving a misplaced builtin doc into the primary language folder. */
export function suggestLocalizedPath(relativePath: string, primaryLangCode: string): string {
  const norm = normalizePath(relativePath);
  const m = norm.match(/^docs\/(srs|basic-design)\/(.+)$/i);
  if (!m) {
    return norm;
  }
  return `docs/${m[1]}/${primaryLangCode}/${m[2]}`;
}

export function localizeProjectionPaths(
  paths: string[],
  primaryLangCode: string,
): string[] {
  return [...new Set(paths.map((p) => localizedOutputForPrimary(p, primaryLangCode)))];
}
