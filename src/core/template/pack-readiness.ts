import type { PackManifest, ManifestDocument } from "../config/types.js";
import type { ScanFile, ScanResult } from "./scan.js";

// ---------------------------------------------------------------------------
// Types (readiness artifacts — consumed by agent skills, not runtime-validated)
// ---------------------------------------------------------------------------

export interface PackReadinessOptions {
  /** e.g. "SRS", "basic design", "arc42", "ADR" */
  purpose?: string;
  /** Standards user selected during import */
  standards?: string[];
}

interface ReadinessCriterion {
  id: string;
  severity: "blocking" | "should-ask" | "nice-to-have";
  field: string;
  question: string;
  graphProbe: string;
  iso29148?: string;
  perEntity?: string;
  acceptAssumption?: boolean;
  placeholder?: string;
  heading?: string;
  minGraphCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugifyField(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function dagIdForDoc(manifest: PackManifest, doc: ManifestDocument): string {
  const packSlug = manifest.packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const docSlug = doc.documentId.replace(/^doc\.[^.]+\./, "").replace(/\./g, "-");
  return doc.perDomain ? `${packSlug}.${docSlug}-breakout` : `${packSlug}.${docSlug}`;
}

function scanFileForDoc(scanResult: ScanResult | undefined, template: string): ScanFile | undefined {
  if (!scanResult) return undefined;
  return scanResult.files.find((f) => f.relativePath === template || f.relativePath.endsWith(`/${template}`));
}

function inferPurpose(manifest: PackManifest, options?: PackReadinessOptions): string {
  if (options?.purpose) return options.purpose;
  const desc = (manifest.description ?? "").toLowerCase();
  if (/srs|requirement|ieee|29148|830/.test(desc)) return "SRS";
  if (/basic.?design|screen|api.?list/.test(desc)) return "basic design";
  if (/arc42|architecture/.test(desc)) return "architecture";
  if (/adr|decision/.test(desc)) return "ADR";
  return "custom documentation";
}

function defaultStandards(purpose: string, userStandards?: string[]): object[] {
  const base = [
    {
      id: "ISO-29148",
      title: "ISO/IEC/IEEE 29148:2018",
      scope: "Requirements engineering — use when pack produces requirements specs",
    },
    {
      id: "CPRE",
      title: "IREB CPRE — Elicitation",
      scope: "System context and requirements sources",
    },
  ];
  if (purpose.toLowerCase().includes("architecture") || purpose === "arc42") {
    base.push({
      id: "arc42",
      title: "arc42 template",
      scope: "Software architecture documentation sections",
    });
  }
  if (userStandards?.length) {
    for (const s of userStandards) {
      if (!base.some((b) => b.id === s || b.title.includes(s))) {
        base.push({ id: s, title: s, scope: "User-selected during template import" });
      }
    }
  }
  return base;
}

function headingSeverity(headingText: string, depth: number): "blocking" | "should-ask" | "nice-to-have" {
  if (depth <= 2 && BLOCKING_HEADING_RE.test(headingText)) return "blocking";
  if (depth <= 3) return "should-ask";
  return "nice-to-have";
}

const BLOCKING_HEADING_RE =
  /\b(purpose|scope|requirement|actor|stakeholder|constraint|security|performance|objective|goal|overview|description|function|interface|data|context|quality|assumption|dependency)\b/i;

function criteriaFromHeadings(
  doc: ManifestDocument,
  scanFile: ScanFile | undefined,
  prefix: string,
): ReadinessCriterion[] {
  if (!scanFile?.headings.length) return [];
  const criteria: ReadinessCriterion[] = [];
  let n = 0;
  for (const h of scanFile.headings) {
    if (h.depth < 2 || h.depth > 4) continue;
    const field = slugifyField(h.text);
    if (!field || field.length < 2) continue;
    n += 1;
    criteria.push({
      id: `${prefix}-${String(n).padStart(3, "0")}`,
      severity: headingSeverity(h.text, h.depth),
      field,
      heading: h.text,
      question: `For "${doc.template}": what content belongs in section "${h.text}"?`,
      graphProbe: `graph context for documentId ${doc.documentId}, section "${h.text}"`,
      iso29148: h.depth <= 2 ? "9.6.10" : undefined,
      acceptAssumption: h.depth >= 3,
    });
  }
  return criteria;
}

function criteriaFromPlaceholders(
  doc: ManifestDocument,
  scanFile: ScanFile | undefined,
  prefix: string,
  knownResolved: Set<string>,
): ReadinessCriterion[] {
  if (!scanFile?.placeholders.length) return [];
  const skip = new Set(["nn", "slug", "lang", "name", "id", "title", "date", "version"]);
  const criteria: ReadinessCriterion[] = [];
  let n = 0;
  for (const ph of scanFile.placeholders) {
    const name = ph.replace(/[{}]/g, "");
    if (skip.has(name)) continue;
    n += 1;
    const resolved = knownResolved.has(ph);
    criteria.push({
      id: `${prefix}-P${String(n).padStart(2, "0")}`,
      severity: resolved ? "should-ask" : "blocking",
      field: slugifyField(name),
      placeholder: ph,
      question: `What value should ${ph} have for "${doc.template}"? (graph field or user input)`,
      graphProbe: resolved
        ? `context-map.json → ${ph}`
        : `context-map.json marks ${ph} as TODO — resolve before generate`,
      acceptAssumption: !resolved,
    });
  }
  return criteria;
}

// ---------------------------------------------------------------------------
// Global criteria (always generated for custom packs)
// ---------------------------------------------------------------------------

function buildGlobalCriteria(manifest: PackManifest, purpose: string): ReadinessCriterion[] {
  const isReqSpec = /srs|requirement/i.test(purpose) || /srs|requirement|ieee/i.test(manifest.description ?? "");
  const globals: ReadinessCriterion[] = [
    {
      id: "G-001",
      severity: "blocking",
      iso29148: "9.6.2, 9.6.3",
      field: "productPurpose",
      question: `What is the product/system name and purpose for pack "${manifest.packName}"?`,
      graphProbe: "system root node name + description",
    },
    {
      id: "G-002",
      severity: "blocking",
      iso29148: "9.6.3.d",
      field: "outOfScope",
      question: "What is explicitly OUT of scope for this documentation run?",
      graphProbe: "nodes with outOfScope: true",
      acceptAssumption: true,
    },
    {
      id: "G-003",
      severity: "blocking",
      iso29148: "5.2.2, 9.6.6",
      field: "stakeholders",
      question: "Who are the stakeholders / user classes (roles, not individual names)?",
      graphProbe: "actor nodes",
      minGraphCount: isReqSpec ? 1 : 0,
      acceptAssumption: !isReqSpec,
    },
    {
      id: "G-004",
      severity: "should-ask",
      iso29148: "9.6.2 References",
      field: "references",
      question: "Which source documents should generation reference (paths in docs/data-source/)?",
      graphProbe: "definedIn / rendersTo edges",
    },
    {
      id: "G-005",
      severity: "should-ask",
      iso29148: "9.6.8",
      field: "assumptions",
      question: "Assumptions and external dependencies that affect requirements?",
      graphProbe: "assumption-tagged nodes",
      acceptAssumption: true,
    },
    {
      id: "G-006",
      severity: "should-ask",
      iso29148: "9.6.7, 9.6.17",
      field: "constraints",
      question: "Regulatory, legal, or technology constraints?",
      graphProbe: "NFR constraint/compliance nodes",
      acceptAssumption: true,
    },
    {
      id: "G-007",
      severity: "blocking",
      iso29148: "5.2.8",
      field: "traceabilityIds",
      question: "Confirm ID scheme for traceable items in this pack (prefixes, numbering)?",
      graphProbe: "existing graph node id patterns",
      acceptAssumption: true,
    },
    {
      id: "G-008",
      severity: "should-ask",
      iso29148: "9.6.19",
      field: "verification",
      question: "How will requirements be verified (test / analysis / inspection / demonstration)?",
      graphProbe: "FR.verificationMethod",
      acceptAssumption: true,
    },
  ];
  return globals;
}

// ---------------------------------------------------------------------------
// Public builders
// ---------------------------------------------------------------------------

/**
 * Build readiness-criteria JSON for a custom template pack.
 * Derived from manifest documents, scan headings, and placeholders.
 */
export function buildPackReadinessCriteria(
  manifest: PackManifest,
  scanResult?: ScanResult,
  options?: PackReadinessOptions,
): object {
  const purpose = inferPurpose(manifest, options);
  const docType = manifest.docType ?? manifest.packName;
  const knownResolved = new Set([
    "{projectName}",
    "{project}",
    "{version}",
    "{date}",
    "{id}",
    "{title}",
    "{nn}",
    "{slug}",
    "{lang}",
  ]);

  const targets: object[] = [];

  for (const doc of manifest.documents) {
    const scanFile = scanFileForDoc(scanResult, doc.template);
    const prefix = doc.documentId.split(".").pop()?.toUpperCase().slice(0, 6) ?? "DOC";
    const headingCriteria = criteriaFromHeadings(doc, scanFile, prefix);
    const placeholderCriteria = criteriaFromPlaceholders(doc, scanFile, prefix, knownResolved);

    const criteria: ReadinessCriterion[] = [...headingCriteria, ...placeholderCriteria];

    if (doc.perDomain) {
      criteria.unshift({
        id: `${prefix}-000`,
        severity: "blocking",
        iso29148: "9.6.10",
        field: `${doc.perDomain}Inventory`,
        question: `Confirm the complete list of ${doc.perDomain} items to generate (ids + titles).`,
        graphProbe: `graph nodes where type === "${doc.perDomain}"`,
        perEntity: doc.perDomain,
        minGraphCount: 1,
      });
      for (const c of criteria) {
        if (!c.perEntity) c.perEntity = doc.perDomain;
      }
    } else if (criteria.length === 0) {
      criteria.push({
        id: `${prefix}-001`,
        severity: "blocking",
        field: "documentContent",
        question: `What key information must "${doc.output ?? doc.template}" contain?`,
        graphProbe: `graph query seed ${doc.documentId}`,
      });
    }

    targets.push({
      dagNode: dagIdForDoc(manifest, doc),
      documentId: doc.documentId,
      outputPattern: doc.output ?? doc.outputPattern,
      template: doc.template,
      perDomain: doc.perDomain ?? undefined,
      iso29148: doc.perDomain ? ["9.6.10", "9.6.12"] : ["9.6.10"],
      criteria,
    });
  }

  return {
    version: 1,
    docType,
    packName: manifest.packName,
    generatedFrom: "template-install",
    purpose,
    standards: defaultStandards(purpose, options?.standards ?? manifest.standards),
    inheritsBuiltinWorkflow: true,
    workflowReferences: [
      "scaffold/cursor/skills/ai-spector/references/generate-workflow.md",
      "scaffold/cursor/skills/ai-spector/references/context-readiness.md",
      "scaffold/cursor/skills/ai-spector/references/clarify.md",
      "scaffold/cursor/skills/ai-spector/references/plan-and-briefing.md",
    ],
    criteriaPath: `.ai-spector/packs/${manifest.packName}/readiness-criteria.json`,
    configCopyPath: `.ai-spector/.docflow/config/doc-types/${manifest.packName}/readiness-criteria.json`,
    requirementQuality: {
      iso29148: "§5.2",
      note: "Apply when pack produces atomic requirements (FR/NFR)",
      individualCharacteristics: [
        "necessary",
        "unambiguous",
        "complete",
        "consistent",
        "correct",
        "feasible",
        "verifiable",
        "modifiable",
        "traceable",
      ],
      verificationMethods: ["test", "analysis", "inspection", "demonstration"],
    },
    dimensions: [
      { id: "scope", label: "Scope & purpose", iso: "9.6.2, 9.6.3" },
      { id: "stakeholders", label: "Stakeholders", iso: "5.2.2, 9.6.6" },
      { id: "graph", label: "Graph coverage", iso: "9.6.10" },
      { id: "data-source", label: "Data-source", iso: "9.6.2" },
      { id: "template", label: "Template placeholders", iso: "pack context-map.json" },
      { id: "verification", label: "Verification", iso: "9.6.19" },
    ],
    globalCriteria: buildGlobalCriteria(manifest, purpose),
    targets,
  };
}

/**
 * Build completeness-rules JSON (output validation) from template headings.
 */
export function buildPackCompletenessRules(
  manifest: PackManifest,
  scanResult?: ScanResult,
): object {
  const rules: object[] = [];

  for (const doc of manifest.documents) {
    if (doc.perDomain) continue;
    const scanFile = scanFileForDoc(scanResult, doc.template);
    const outputName = (doc.output ?? doc.outputPattern ?? doc.template).split("/").pop() ?? doc.template;
    const requiredHeadings = (scanFile?.headings ?? [])
      .filter((h) => h.depth >= 2 && h.depth <= 3)
      .map((h) => `${"#".repeat(h.depth)} ${h.text.replace(/\{[^}]+\}/g, "").trim()}`)
      .filter((t) => t.length > 3);

    if (requiredHeadings.length > 0) {
      rules.push({
        target: outputName,
        documentId: doc.documentId,
        requiredHeadings,
      });
    }
  }

  return {
    version: 1,
    packName: manifest.packName,
    generatedFrom: "template-install",
    defaultChecks: {
      disallowPlaceholders: ["<", "TODO", "TBD", "{", "}"],
      requireNonEmptyTables: true,
      validateMarkdownLinks: true,
    },
    rules,
  };
}

/**
 * Human + agent readable workflow setup guide written into the pack directory.
 */
export function buildWorkflowSetupMarkdown(manifest: PackManifest, options?: PackReadinessOptions): string {
  const purpose = inferPurpose(manifest, options);
  const docType = manifest.docType ?? manifest.packName;
  const name = manifest.packName;

  return [
    `# Workflow setup — pack: ${name}`,
    "",
    `> Auto-generated by \`template install\`. Aligns custom template generation with builtin gated workflow.`,
    "",
    "## Purpose",
    "",
    `- **Pack purpose:** ${purpose}`,
    `- **Context store docType:** \`${docType}\``,
    `- **Generate skill:** \`ai-spector-generate-${name}\``,
    "",
    "## Gated flow (mandatory — same as builtin SRS)",
    "",
    "```",
    "0. TASK      task_list → bootstrap generate task for this pack",
    "1. CHECK     workspace_check",
    "2. CLARIFY   readiness report (readiness-criteria.json) → gap questions → context store",
    "3. BRIEFING  per-document context summary → user confirms",
    "4. PLAN      plan table → task_update(plan) → task_approve_plan → explicit yes",
    "5. GENERATE  waves per generate-hints.md",
    "6. EXTRACT   offer spec extraction when applicable",
    "```",
    "",
    "## Readiness criteria",
    "",
    "| File | Role |",
    "|------|------|",
    `| \`.ai-spector/packs/${name}/readiness-criteria.json\` | Per-pack input criteria (headings + placeholders + ISO global) |`,
    `| \`.ai-spector/.docflow/config/doc-types/${name}/readiness-criteria.json\` | Copy for workspace_check / tools |`,
    `| \`.ai-spector/packs/${name}/completeness-rules.json\` | Output validation (required headings) |`,
    `| \`.ai-spector/packs/${name}/context-map.json\` | Placeholder → graph source (resolve TODOs) |`,
    "",
    "Before first generate:",
    "",
    "1. Read `readiness-criteria.json` for targets in scope",
    "2. Resolve every `TODO` in `context-map.json`",
    "3. Run readiness assessment (`.cursor/skills/ai-spector/references/context-readiness.md`)",
    "",
    "## Task slot",
    "",
    "Use bootstrap with pack-specific workflow:",
    "",
    "```json",
    "task_list({",
    '  "bootstrap": {',
    '    "kind": "generate",',
    `    "workflow": "generate-${name}",`,
    `    "docType": "${docType}",`,
    `    "trigger": "generate ${name}"`,
    "  }",
    "})",
    "```",
    "",
    "## Review after import",
    "",
    "The AI should walk the user through:",
    "",
    "1. **Standards** — confirm `standards[]` in readiness-criteria.json",
    "2. **Blocking criteria** — adjust severity or add domain-specific questions",
    "3. **context-map TODOs** — map each placeholder to graph field or user question",
    "4. **Incremental continuation** — if user adds documents mid-session, extend plan before generate",
    "",
    "## References",
    "",
    "- `generate-hints.md` — wave order",
    "- `manifest.json` — document IDs and outputs",
    "- `.cursor/skills/ai-spector/references/incremental-continuation.md`",
    "",
  ].join("\n");
}
