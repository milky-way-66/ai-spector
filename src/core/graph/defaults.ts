/** Default SRS section anchors when `listedInSection` is omitted in knowledge.json */
export const DEFAULT_LISTED_IN = {
  actor: "sec.srs.2-overall-description.l3.3.22-user-classes-and-characteristics",
  useCase: "sec.srs.3-use-cases.l3.3.32-list-use-case",
  feature: "sec.srs.4-system-features.l3.3.42-list-of-system-features",
  functionalRequirement: "sec.srs.4-system-features.l3.3.42-list-of-system-features",
  nfr: "sec.srs.7-quality-attributes.l2.1.7-non-functional-requirements-quality-attributes",
  dataEntity: "sec.srs.5-data-requirements.l3.2.51-logical-data-model",
} as const;

/** Basic-design list chapter documents (from generate merge / graph-seeds). */
export const DEFAULT_BD_LIST_DOC = {
  apiList: "doc.bd.list-api",
  screenList: "doc.bd.list-screen",
  dbDesign: "doc.bd.db-design",
} as const;

export const BASIC_DESIGN_LIST_DOCUMENT_IDS: ReadonlySet<string> = new Set(
  Object.values(DEFAULT_BD_LIST_DOC),
);

export function isBasicDesignListChapterDocumentId(id: string): boolean {
  return BASIC_DESIGN_LIST_DOCUMENT_IDS.has(id);
}

/** Template document ids for per-domain basic-design detail (DAG / graph-seeds). */
export const PER_DOMAIN_TEMPLATE_DOC_BD = {
  api: "doc.bd.detail-api",
  screen: "doc.bd.detail-screen",
} as const;
