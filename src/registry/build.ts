import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RegistryDocument, RegistrySection, SectionRegistry } from "../types.js";
import { loadDocflowConfig, loadDocumentsManifest } from "../config/load.js";
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

export async function buildSectionRegistry(
  root?: string,
): Promise<SectionRegistry> {
  const { root: projectRoot } = await loadDocflowConfig(root);
  const { bundleRoot, manifest } = await loadDocumentsManifest();
  const templatesDir = join(bundleRoot, manifest.templatesDir);
  const documents: RegistryDocument[] = [];

  for (const doc of manifest.documents) {
    documents.push(await scanTemplate(templatesDir, doc));
  }

  return {
    version: 1,
    root: projectRoot,
    documents,
  };
}
