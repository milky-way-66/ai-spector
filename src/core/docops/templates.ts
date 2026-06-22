import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";

export async function countMarkdownInDir(absDir: string): Promise<number> {
  if (!(await pathExists(absDir))) return 0;
  let count = 0;
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const ent of entries) {
    const child = join(absDir, ent.name);
    if (ent.isDirectory()) {
      count += await countMarkdownInDir(child);
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      count += 1;
    }
  }
  return count;
}

export interface CopyTemplatesOptions {
  projectRoot: string;
  layerKey: string;
  destRel: string;
  sources: string[]; // absolute dirs, priority order
  dryRun?: boolean;
}

export interface CopyTemplatesResult {
  copied: boolean;
  actions: string[];
}

export async function copyTemplates(opts: CopyTemplatesOptions): Promise<CopyTemplatesResult> {
  const { projectRoot, layerKey, destRel, sources, dryRun = false } = opts;
  const actions: string[] = [];
  const destAbs = join(projectRoot, destRel);
  const existing = await countMarkdownInDir(destAbs);
  if (existing > 0) {
    actions.push(`skip templates/${layerKey} (destination has ${existing} .md)`);
    return { copied: false, actions };
  }

  for (const srcAbs of sources) {
    if (!(await pathExists(srcAbs))) continue;
    const srcCount = await countMarkdownInDir(srcAbs);
    if (srcCount === 0) continue;

    actions.push(
      `${dryRun ? "would copy" : "copy"} ${srcAbs.replace(projectRoot, ".")} → ${destRel}/ (${srcCount} .md)`,
    );
    if (!dryRun) {
      await mkdir(destAbs, { recursive: true });
      await cp(srcAbs, destAbs, { recursive: true, force: false });
    }
    return { copied: true, actions };
  }

  actions.push(`warn templates/${layerKey}: no non-empty source found`);
  return { copied: false, actions };
}
