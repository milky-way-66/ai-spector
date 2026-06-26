import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { DocopsConfig } from "../types.js";
import { segmentRepoPrefixMap } from "../paths.js";
import { pathExists } from "../../util/fs.js";
import { normalizeLogicalKey } from "./load.js";

const DOC_TYPE_KEY_TO_SEGMENT: Record<string, string> = {
  srs: "srs",
  basicDesign: "basic-design",
  detailDesign: "detail-design",
};

const DOC_TYPE_KEY_TO_LABEL: Record<string, string> = {
  srs: "SRS",
  basicDesign: "BasicDesign",
  detailDesign: "DetailDesign",
};

export interface DiscoveredDocument {
  logicalPath: string;
  docType: string;
  repoDocs: Record<string, string>;
  displayName: string;
}

function languageCodes(config: DocopsConfig): string[] {
  return (config.languages ?? []).map((l) => l.code.trim().toLowerCase()).filter(Boolean);
}

function isLanguageSegment(segment: string, langs: string[]): boolean {
  return langs.includes(segment.trim().toLowerCase());
}

async function walkMarkdownFiles(dirAbs: string): Promise<string[]> {
  const out: string[] = [];
  if (!(await pathExists(dirAbs))) return out;

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        out.push(full);
      }
    }
  }

  await walk(dirAbs);
  return out;
}

function logicalPathFromRepoRelative(
  repoRelative: string,
  typeSegment: string,
  langs: string[],
): string {
  const parts = repoRelative.replace(/\\/g, "/").split("/").filter(Boolean);
  let restParts = parts;
  if (parts.length > 0 && isLanguageSegment(parts[0]!, langs)) {
    restParts = parts.slice(1);
  }
  const rest = restParts.join("/");
  const logical = rest ? `${typeSegment}/${rest}` : `${typeSegment}.md`;
  return normalizeLogicalKey(logical);
}

function displayNameFromLogical(logicalPath: string): string {
  const base = logicalPath.split("/").pop() ?? logicalPath;
  return base.replace(/\.md$/i, "");
}

export async function discoverDocumentsFromTree(
  projectRoot: string,
  config: DocopsConfig,
): Promise<DiscoveredDocument[]> {
  const langs = languageCodes(config);
  const prefixMap = segmentRepoPrefixMap(config);
  const byLogical = new Map<string, DiscoveredDocument>();

  const docTypes = config.docTypes ?? {};
  for (const [key, layer] of Object.entries(docTypes)) {
    if (layer?.enabled === false) continue;
    const typeSegment = DOC_TYPE_KEY_TO_SEGMENT[key];
    const docTypeLabel = DOC_TYPE_KEY_TO_LABEL[key];
    if (!typeSegment || !docTypeLabel) continue;

    const folder = (layer.path?.trim() || prefixMap[typeSegment] || "").replace(/\\/g, "/");
    if (!folder) continue;

    const folderAbs = join(projectRoot, folder);
    const mdFiles = await walkMarkdownFiles(folderAbs);

    for (const abs of mdFiles) {
      const repoPath = relative(projectRoot, abs).replace(/\\/g, "/");
      const withinFolder = relative(folderAbs, abs).replace(/\\/g, "/");
      const parts = withinFolder.split("/").filter(Boolean);
      if (!parts.length) continue;

      let langCode: string | null = null;
      let pathAfterLang = parts;
      if (parts.length > 0 && isLanguageSegment(parts[0]!, langs)) {
        langCode = parts[0]!.toLowerCase();
        pathAfterLang = parts.slice(1);
      } else if (langs.length === 1) {
        langCode = langs[0]!;
      } else if (langs.length > 1) {
        // Multi-lang project but file not under lang folder — treat as primary only.
        langCode = (config.primaryLanguage ?? langs[0] ?? "en").toLowerCase();
      } else {
        langCode = "en";
      }

      const logicalPath = logicalPathFromRepoRelative(
        pathAfterLang.join("/"),
        typeSegment,
        langs,
      );

      let entry = byLogical.get(logicalPath);
      if (!entry) {
        entry = {
          logicalPath,
          docType: docTypeLabel,
          repoDocs: {},
          displayName: displayNameFromLogical(logicalPath),
        };
        byLogical.set(logicalPath, entry);
      }
      entry.repoDocs[langCode] = repoPath;
    }
  }

  return [...byLogical.values()].sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
}

export { DOC_TYPE_KEY_TO_SEGMENT, DOC_TYPE_KEY_TO_LABEL };
