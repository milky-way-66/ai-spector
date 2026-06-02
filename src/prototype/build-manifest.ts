import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import type {
  PrototypeConfig,
  PrototypeManifest,
  PrototypeScreenMap,
} from "./types.js";
import { parseScreenIndexFromList } from "./parse-screen-index.js";
import { pathExists, writeJson } from "../util/fs.js";

async function htmlExists(projectRoot: string, relativePath: string): Promise<boolean> {
  try {
    await access(join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

export interface BuildPrototypeManifestOptions {
  projectRoot: string;
  config: PrototypeConfig;
  themeName: string;
}

export interface BuildPrototypeManifestResult {
  manifest: PrototypeManifest;
  screenMap: PrototypeScreenMap;
  screenCount: number;
  htmlCount: number;
}

export async function buildPrototypeManifest(
  opts: BuildPrototypeManifestOptions,
): Promise<BuildPrototypeManifestResult> {
  const listPath = join(opts.projectRoot, opts.config.listScreenDoc);
  if (!(await pathExists(listPath))) {
    throw new Error(
      `Missing ${opts.config.listScreenDoc}. Run /generate-basic-design (list + screen details) first.`,
    );
  }
  const listMarkdown = await readFile(listPath, "utf8");
  const rows = parseScreenIndexFromList({
    projectRoot: opts.projectRoot,
    config: opts.config,
    listMarkdown,
  });
  if (rows.length === 0) {
    throw new Error(
      `No screens found in ${opts.config.listScreenDoc} (${opts.config.screenIndexSection}). Add rows to the Screen Index table.`,
    );
  }

  const generatedAt = new Date().toISOString();
  let htmlCount = 0;

  const manifestScreens = rows.map((r) => ({
    screenId: r.screenId,
    displayName: r.displayName,
    prototypeStem: r.prototypeStem,
    screenDoc: r.screenDoc,
    ...(r.purpose ? { purpose: r.purpose } : {}),
    ...(r.userRole ? { userRole: r.userRole } : {}),
  }));

  const mapScreens = await Promise.all(
    rows.map(async (r) => {
      const exists = await htmlExists(opts.projectRoot, r.prototypePath);
      if (exists) {
        htmlCount++;
      }
      return {
        screenId: r.screenId,
        displayName: r.displayName,
        screenDoc: r.screenDoc,
        prototypeStem: r.prototypeStem,
        prototypePath: r.prototypePath,
        htmlExists: exists,
      };
    }),
  );

  const manifest: PrototypeManifest = {
    schemaVersion: 1,
    themeName: opts.themeName,
    generatedAt,
    screens: manifestScreens,
  };

  const screenMap: PrototypeScreenMap = {
    schemaVersion: 1,
    themeName: opts.themeName,
    generatedAt,
    screens: mapScreens,
  };

  return {
    manifest,
    screenMap,
    screenCount: rows.length,
    htmlCount,
  };
}

export async function writePrototypeManifestFiles(
  projectRoot: string,
  config: PrototypeConfig,
  result: BuildPrototypeManifestResult,
): Promise<{ manifestPath: string; screenMapPath: string }> {
  const manifestPath = join(projectRoot, config.prototypeDir, "manifest.json");
  const screenMapPath = join(projectRoot, config.prototypeDir, "screen-map.json");
  await writeJson(manifestPath, result.manifest);
  await writeJson(screenMapPath, result.screenMap);
  return { manifestPath, screenMapPath };
}
