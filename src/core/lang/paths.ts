import { createHash } from "node:crypto";
import type { DocType } from "./queue-types.js";

export function hashFileContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function resolveDocPath(docType: DocType, lang: string, relativePath: string): string {
  return `docs/${docType}/${lang}/${relativePath}`.replace(/\\/g, "/");
}

export function parseDocFilePath(
  filePath: string,
): { docType: DocType; lang: string; relativePath: string } | null {
  const norm = filePath.replace(/\\/g, "/");
  const m = norm.match(/^docs\/(srs|basic-design)\/([^/]+)\/(.+\.md)$/i);
  if (!m) {
    return null;
  }
  return {
    docType: m[1] as DocType,
    lang: m[2]!,
    relativePath: m[3]!,
  };
}

export function jobGroupKey(docType: DocType, relativePath: string): string {
  return `${docType}|${relativePath}`;
}

export function parseJobGroupKey(groupKey: string): { docType: DocType; relativePath: string } {
  const [docType, relativePath] = groupKey.split("|");
  return { docType: docType as DocType, relativePath: relativePath! };
}

/** Filename for per-document change store under `translation-queue/changes/`. */
export function fileChangesFileName(docType: DocType, relativePath: string): string {
  const safe = relativePath.replace(/\//g, "--");
  return `${docType}--${safe}.json`;
}
