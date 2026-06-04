/**
 * Detect and rewrite root-absolute local asset refs in HTML.
 * Paths like `/assets/app.js` break when the prototype is served from a subdirectory;
 * use `./assets/app.js` (relative to the current HTML file) instead.
 */

/** Matches src/href="/local/path" but not protocol-relative (//) or same-page anchors (#). */
const ABSOLUTE_LOCAL_REF_RE =
  /\b(src|href)\s*=\s*(["'])\/(?!\/|#)([^"']+)\2/gi;

export function findAbsoluteLocalRefs(html: string): string[] {
  const refs: string[] = [];
  const re = new RegExp(ABSOLUTE_LOCAL_REF_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    refs.push(`/${match[3]}`);
  }
  return refs;
}

export function rewriteAbsoluteLocalRefs(html: string): string {
  return html.replace(
    ABSOLUTE_LOCAL_REF_RE,
    (_full, attr: string, quote: string, path: string) =>
      `${attr}=${quote}./${path}${quote}`,
  );
}

export function htmlHasAbsoluteLocalRefs(html: string): boolean {
  return findAbsoluteLocalRefs(html).length > 0;
}
