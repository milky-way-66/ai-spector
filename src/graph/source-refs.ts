/** Repo-relative paths under docs/data-source mentioned in markdown. */
const DATA_SOURCE_PATH_RE =
  /(?:^|[\s`(\[])(docs\/data-source\/[^\s`)\]>]+)/gi;

const SOURCE_LINE_RE =
  /^\s*(?:\*\*)?(?:Source|Data\s+source|Provenance|Origin)(?:\*\*)?\s*:\s*(.+)$/gim;

const BACKTICK_PATH_RE = /`([^`]+\.(?:md|ts|tsx|js|py|go|rs|json|yaml|yml))`/gi;

export function extractSourceRefsFromMarkdown(content: string): string[] {
  const refs = new Set<string>();

  for (const m of content.matchAll(DATA_SOURCE_PATH_RE)) {
    const p = (m[1] ?? m[0]).replace(/^[(\[`\s]+/, "").trim();
    if (p.startsWith("docs/data-source/")) {
      refs.add(p);
    }
  }

  for (const m of content.matchAll(SOURCE_LINE_RE)) {
    const line = m[1]!.trim();
    for (const part of line.split(/[,;]/)) {
      const t = part.trim().replace(/^[`'"]+|[`'"]+$/g, "");
      if (t) {
        refs.add(t);
      }
    }
  }

  for (const m of content.matchAll(BACKTICK_PATH_RE)) {
    const t = m[1]!.trim();
    if (t.includes("data-source") || t.startsWith("docs/")) {
      refs.add(t);
    }
  }

  return [...refs];
}
