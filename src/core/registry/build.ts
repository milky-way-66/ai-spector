import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RegistryDocument, RegistrySection, SectionRegistry } from "@/types.js";
import {
  loadBasicDesignListManifest,
  loadDetailDesignListManifest,
  loadDocflowConfig,
  loadDocumentsManifest,
  resolveActiveManifests,
  resolveProjectTemplatesDir,
} from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { sectionIdFromHeading } from "./slug.js";
import { parseMarkdown, textContent } from "../markdown/parse.js";
import type { Heading } from "../markdown/parse.js";

function parseSections(content: string): RegistrySection[] {
  const root = parseMarkdown(content);
  const sections: RegistrySection[] = [];
  let order = 0;
  for (const node of root.children) {
    if (node.type !== "heading") continue;
    const h = node as Heading;
    if (h.depth < 2 || h.depth > 4) continue;
    order += 1;
    sections.push({
      id: "",
      heading: textContent(h).trim(),
      level: h.depth,
      order,
    });
  }
  return sections;
}

async function scanTemplate(
  templatesDir: string,
  doc: Omit<RegistryDocument, "sections">,
): Promise<RegistryDocument> {
  const path = join(templatesDir, doc.template);
  const content = await readFile(path, "utf8");
  const raw = parseSections(content);
  const sections = raw.map((s) => ({
    ...s,
    id: sectionIdFromHeading(doc.documentId, s.heading, s.level, s.order ?? 0),
  }));
  return { ...doc, sections };
}

async function resolveTemplatesSubdir(
  projectRoot: string,
  config: Awaited<ReturnType<typeof loadDocflowConfig>>["config"],
  bundleRoot: string,
  bundledRelativeDir: string,
  subfolder: "srs" | "basic_design" | "detail_design",
): Promise<string> {
  const projectDir = join(resolveProjectTemplatesDir(projectRoot, config), subfolder);
  if (await pathExists(projectDir)) {
    return projectDir;
  }
  return join(bundleRoot, bundledRelativeDir);
}

/** Scan basic-design list-chapter templates (api-list, screen map, db-design). */
export async function scanBasicDesignListDocuments(
  projectRoot: string,
): Promise<RegistryDocument[]> {
  const { config } = await loadDocflowConfig(projectRoot);
  const { bundleRoot } = await loadDocumentsManifest();
  const bdManifest = await loadBasicDesignListManifest();
  const bdTemplatesDir = await resolveTemplatesSubdir(
    projectRoot,
    config,
    bundleRoot,
    bdManifest.templatesDir,
    "basic_design",
  );
  const documents: RegistryDocument[] = [];
  for (const doc of bdManifest.documents) {
    documents.push(await scanTemplate(bdTemplatesDir, doc));
  }
  return documents;
}

/** Scan detail-design list-chapter templates (common chapters + feature list). */
export async function scanDetailDesignListDocuments(
  projectRoot: string,
): Promise<RegistryDocument[]> {
  const { config } = await loadDocflowConfig(projectRoot);
  const { bundleRoot } = await loadDocumentsManifest();
  const ddManifest = await loadDetailDesignListManifest();
  const ddTemplatesDir = await resolveTemplatesSubdir(
    projectRoot,
    config,
    bundleRoot,
    ddManifest.templatesDir,
    "detail_design",
  );
  const documents: RegistryDocument[] = [];
  for (const doc of ddManifest.documents) {
    documents.push(await scanTemplate(ddTemplatesDir, doc));
  }
  return documents;
}

export async function buildSectionRegistry(
  root?: string,
): Promise<SectionRegistry> {
  const { root: projectRoot, config } = await loadDocflowConfig(root);
  const packs = await resolveActiveManifests(projectRoot, config);

  const documents: RegistryDocument[] = [];
  for (const { manifest, templatesDir } of packs) {
    for (const doc of manifest.documents) {
      documents.push(await scanTemplate(templatesDir, doc));
    }
  }

  return {
    version: 1,
    root: projectRoot,
    documents,
  };
}
