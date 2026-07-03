import { mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../util/fs.js";

const CANONICAL_REL = "docs/data-source";
const LEGACY_ROOT_REL = "data-source";

/** Move repo-root `data-source/` into canonical `docs/data-source/`. */
export async function migrateRootDataSourceToCanonical(
  projectRoot: string,
): Promise<{ migrated: string[]; skipped: boolean; reason?: string }> {
  const legacyDir = join(projectRoot, LEGACY_ROOT_REL);
  if (!(await pathExists(legacyDir))) {
    return { migrated: [], skipped: true, reason: "no root data-source" };
  }

  const canonicalDir = join(projectRoot, CANONICAL_REL);
  await mkdir(canonicalDir, { recursive: true });

  const migrated: string[] = [];
  const entries = await readdir(legacyDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const from = join(legacyDir, entry.name);
    const to = join(canonicalDir, entry.name);
    if (await pathExists(to)) {
      continue;
    }
    await rename(from, to);
    migrated.push(`${LEGACY_ROOT_REL}/${entry.name} → ${CANONICAL_REL}/${entry.name}`);
  }

  const remaining = await readdir(legacyDir).catch(() => []);
  const meaningfulLeft = remaining.filter((n) => n !== ".gitkeep" && !n.startsWith("."));
  if (meaningfulLeft.length === 0) {
    try {
      await rename(legacyDir, join(projectRoot, ".data-source.migrated"));
    } catch {
      // non-fatal — files already moved
    }
  }

  return { migrated, skipped: migrated.length === 0 };
}
