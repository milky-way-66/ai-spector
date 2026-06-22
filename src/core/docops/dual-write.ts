import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { writeJson, writeJsonAtomic } from "../util/fs.js";
import { docopsDualWriteEnabled } from "./paths.js";

export interface DualWriteRoots {
  primary: string;
  legacy?: string;
}

export function mirrorRoots(primaryRel: string, legacyRel?: string): DualWriteRoots {
  if (!docopsDualWriteEnabled() || !legacyRel || legacyRel === primaryRel) {
    return { primary: primaryRel };
  }
  return { primary: primaryRel, legacy: legacyRel };
}

export async function writeJsonDual(
  projectRoot: string,
  roots: DualWriteRoots,
  relativePath: string,
  data: unknown,
): Promise<void> {
  const primaryAbs = join(projectRoot, roots.primary, relativePath);
  await writeJson(primaryAbs, data);
  if (roots.legacy) {
    const legacyAbs = join(projectRoot, roots.legacy, relativePath);
    await writeJson(legacyAbs, data);
  }
}

export async function writeJsonAtomicDual(
  projectRoot: string,
  roots: DualWriteRoots,
  relativePath: string,
  data: unknown,
): Promise<void> {
  const primaryAbs = join(projectRoot, roots.primary, relativePath);
  await writeJsonAtomic(primaryAbs, data);
  if (roots.legacy) {
    const legacyAbs = join(projectRoot, roots.legacy, relativePath);
    await writeJsonAtomic(legacyAbs, data);
  }
}

export async function writeFileDual(
  projectRoot: string,
  roots: DualWriteRoots,
  relativePath: string,
  content: string,
  options?: { append?: boolean },
): Promise<void> {
  const writeOpts = options?.append ? { flag: "a" as const } : undefined;
  const primaryAbs = join(projectRoot, roots.primary, relativePath);
  await mkdir(dirname(primaryAbs), { recursive: true });
  await writeFile(primaryAbs, content, writeOpts);
  if (roots.legacy) {
    const legacyAbs = join(projectRoot, roots.legacy, relativePath);
    await mkdir(dirname(legacyAbs), { recursive: true });
    await writeFile(legacyAbs, content, writeOpts);
  }
}

export async function mirrorTree(
  projectRoot: string,
  srcRel: string,
  destRel: string,
): Promise<void> {
  const srcAbs = join(projectRoot, srcRel);
  const destAbs = join(projectRoot, destRel);
  await mkdir(dirname(destAbs), { recursive: true });
  await cp(srcAbs, destAbs, { recursive: true, force: true });
}
