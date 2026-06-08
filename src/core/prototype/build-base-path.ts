import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrototypeTechStack } from "./types.js";
import { pathExists } from "../util/fs.js";

const VITE_STACKS = new Set<PrototypeTechStack>(["vue", "react", "svelte"]);

const VITE_CONFIG_NAMES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
];

/** Vite `base` set to a root-absolute path (default when omitted). */
const VITE_ABSOLUTE_BASE_RE = /\bbase\s*:\s*(['"])\/(?!\.)\1/;

/** Vite `base` explicitly set to relative (./ or empty-relative). */
const VITE_RELATIVE_BASE_RE = /\bbase\s*:\s*(['"])\.\/?\1/;

export interface ViteBasePathCheck {
  configPath: string | null;
  relativeBase: boolean;
  /** True when a vite config exists but base is root-absolute or missing (Vite default `/`). */
  needsRelativeBase: boolean;
}

async function findViteConfig(projectRoot: string): Promise<string | null> {
  const searchRoots = [projectRoot, join(projectRoot, "frontend"), join(projectRoot, "prototype")];
  for (const root of searchRoots) {
    if (!(await pathExists(root))) {
      continue;
    }
    for (const name of VITE_CONFIG_NAMES) {
      const candidate = join(root, name);
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
    // One level of subdirs (e.g. frontend/app/vite.config.ts)
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        for (const name of VITE_CONFIG_NAMES) {
          const candidate = join(root, entry.name, name);
          if (await pathExists(candidate)) {
            return candidate;
          }
        }
      }
    } catch {
      // ignore unreadable dirs
    }
  }
  return null;
}

export function viteConfigNeedsRelativeBase(content: string): boolean {
  if (VITE_RELATIVE_BASE_RE.test(content)) {
    return false;
  }
  // Explicit absolute base, or no base key (Vite default is `/`)
  if (VITE_ABSOLUTE_BASE_RE.test(content)) {
    return true;
  }
  return !/\bbase\s*:/.test(content);
}

export async function checkViteRelativeBase(
  projectRoot: string,
  techStack?: PrototypeTechStack,
): Promise<ViteBasePathCheck | null> {
  if (!techStack || !VITE_STACKS.has(techStack)) {
    return null;
  }
  const configPath = await findViteConfig(projectRoot);
  if (!configPath) {
    return {
      configPath: null,
      relativeBase: false,
      needsRelativeBase: true,
    };
  }
  const content = await readFile(configPath, "utf8");
  const needsRelativeBase = viteConfigNeedsRelativeBase(content);
  return {
    configPath,
    relativeBase: !needsRelativeBase,
    needsRelativeBase,
  };
}

export function formatViteBasePathHint(check: ViteBasePathCheck): string {
  if (check.configPath) {
    return `Set base: './' in ${check.configPath} before npm run build`;
  }
  return "Add vite.config.ts with base: './' before npm run build";
}
