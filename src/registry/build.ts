import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RegistryDocument, RegistrySection, SectionRegistry } from "../types.js";
import {
  loadBasicDesignListManifest,
  loadDocflowConfig,
  loadDocumentsManifest,
  resolveProjectTemplatesDir,
} from "../config/load.js";
import { pathExists } from "../util/fs.js";
import { sectionIdFromHeading } from "./slug.js";

const HEADING_RE = /^(#{2,4})\s+(.+)$/;

function parseSections(content: string): RegistrySection[] {
  const sections: RegistrySection[] = [];
  let order = 0;
  for (const line of content.split("\n")) {
    if (line.startsWith(">")) {
      continue;
    }
    const m = HEADING_RE.exec(line.trim());
    if (!m) {
      continue;
    }
    const level = m[1].length;
    const heading = m[2].trim();
    order += 1;
    sections.push({
      id: "",
      heading,
      level,
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
  subfolder: "srs" | "basic_design",
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

export async function buildSectionRegistry(
  root?: string,
): Promise<SectionRegistry> {
  const { root: projectRoot, config } = await loadDocflowConfig(root);
  const { bundleRoot, manifest: srsManifest } = await loadDocumentsManifest();
  const bdManifest = await loadBasicDesignListManifest();

  const srsTemplatesDir = await resolveTemplatesSubdir(
    projectRoot,
    config,
    bundleRoot,
    srsManifest.templatesDir,
    "srs",
  );
  const bdTemplatesDir = await resolveTemplatesSubdir(
    projectRoot,
    config,
    bundleRoot,
    bdManifest.templatesDir,
    "basic_design",
  );

  const documents: RegistryDocument[] = [];

  for (const doc of srsManifest.documents) {
    documents.push(await scanTemplate(srsTemplatesDir, doc));
  }
  for (const doc of bdManifest.documents) {
    documents.push(await scanTemplate(bdTemplatesDir, doc));
  }

  return {
    version: 1,
    root: projectRoot,
    documents,
  };
}
