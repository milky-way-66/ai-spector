import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { rewriteAbsoluteLocalRefs, htmlHasAbsoluteLocalRefs } from "./relative-assets.js";

export interface RewriteBuildAssetsResult {
  filesScanned: number;
  filesRewritten: number;
  rewrittenPaths: string[];
}

async function walkHtmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkHtmlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

/** Rewrite root-absolute asset refs in HTML under a build output directory. */
export async function rewriteBuildAssetRefs(
  buildDestAbs: string,
): Promise<RewriteBuildAssetsResult> {
  const htmlFiles = await walkHtmlFiles(buildDestAbs);
  const result: RewriteBuildAssetsResult = {
    filesScanned: htmlFiles.length,
    filesRewritten: 0,
    rewrittenPaths: [],
  };

  for (const filePath of htmlFiles) {
    const original = await readFile(filePath, "utf8");
    if (!htmlHasAbsoluteLocalRefs(original)) {
      continue;
    }
    const rewritten = rewriteAbsoluteLocalRefs(original);
    if (rewritten !== original) {
      await writeFile(filePath, rewritten, "utf8");
      result.filesRewritten += 1;
      result.rewrittenPaths.push(filePath);
    }
  }

  return result;
}
