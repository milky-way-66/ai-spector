export interface RegistrySection {
  id: string;
  heading: string;
  level: number;
  order?: number;
}

export interface RegistryDocument {
  documentId: string;
  template: string;
  output?: string;
  outputPattern?: string;
  perDomain?: "useCase" | "feature";
  sections: RegistrySection[];
}

export interface SectionRegistry {
  version: number;
  root: string;
  documents: RegistryDocument[];
}

export function parseSectionRegistry(json: unknown): SectionRegistry {
  if (!json || typeof json !== "object") {
    throw new Error("section-registry.json must be an object");
  }
  const raw = json as Partial<SectionRegistry>;
  if (!Array.isArray(raw.documents)) {
    throw new Error("section-registry.json missing documents array");
  }
  return {
    version: raw.version ?? 1,
    root: raw.root ?? "",
    documents: raw.documents,
  };
}

export function findRegistryDocument(
  registry: SectionRegistry,
  documentId: string,
): RegistryDocument | undefined {
  return registry.documents.find((d) => d.documentId === documentId);
}

export function findRegistrySection(
  registry: SectionRegistry,
  sectionId: string,
): { document: RegistryDocument; section: RegistrySection } | undefined {
  for (const document of registry.documents) {
    const section = document.sections.find((s) => s.id === sectionId);
    if (section) {
      return { document, section };
    }
  }
  return undefined;
}

export function sectionHeading(
  registry: SectionRegistry,
  sectionId: string,
): string | undefined {
  return findRegistrySection(registry, sectionId)?.section.heading;
}

/** Alias for sectionHeading — human label for a section id. */
export function sectionLabel(
  registry: SectionRegistry,
  sectionId: string,
): string | undefined {
  return sectionHeading(registry, sectionId);
}

export function documentTemplate(
  registry: SectionRegistry,
  documentId: string,
): string | undefined {
  return findRegistryDocument(registry, documentId)?.template;
}

/** All registry documents (template tree roots). */
export function registryDocuments(registry: SectionRegistry): RegistryDocument[] {
  return registry.documents;
}

/** Flat list of every section across all documents. */
export function allRegistrySections(
  registry: SectionRegistry,
): Array<{ document: RegistryDocument; section: RegistrySection }> {
  const out: Array<{ document: RegistryDocument; section: RegistrySection }> = [];
  for (const document of registry.documents) {
    for (const section of document.sections) {
      out.push({ document, section });
    }
  }
  return out;
}
