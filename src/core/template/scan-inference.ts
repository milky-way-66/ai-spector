import { basename } from "node:path";
import type { ScanFile, ScanResult } from "./scan.js";
import {
  BUILTIN_GRAPH_DOMAIN_TYPES,
  emptyAspectCoverage,
  IMPORT_ASPECT_IDS,
  type ImportSupplementalQuestion,
  type AspectConfidence,
  type AspectStatus,
  type ImportAspectCoverage,
  type ImportAspectId,
} from "./import-aspects.js";

export interface ScanFileDigest {
  relativePath: string;
  headings: string[];
  placeholders: string[];
  signals: string[];
}

export interface RepeatingCandidate {
  path: string;
  perDomainHint: string | null;
  evidence: string[];
}

export interface ScanInferenceProjectContext {
  docsDirs?: string[];
  languages?: string[];
}

export interface ScanInferenceResult {
  aspectCoverage: ImportAspectCoverage[];
  scanDigest: ScanFileDigest[];
  repeatingCandidates: RepeatingCandidate[];
  supplementalQuestions: ImportSupplementalQuestion[];
}

const COMMON_PLACEHOLDERS = new Set([
  "{projectName}",
  "{version}",
  "{name}",
  "{nn}",
  "{slug}",
  "{lang}",
  "{title}",
  "{date}",
  "{author}",
  "{actor}",
  "{description}",
]);

const VOCABULARY_PATTERNS: Array<{ re: RegExp; perDomain: string; label: string }> = [
  { re: /use[-_ ]?case/i, perDomain: "useCase", label: "use case" },
  { re: /feature/i, perDomain: "feature", label: "feature" },
  { re: /requirement/i, perDomain: "requirement", label: "requirement" },
  { re: /\bepic\b/i, perDomain: "epic", label: "epic" },
  { re: /user[-_ ]?story/i, perDomain: "story", label: "user story" },
  { re: /\bmodule\b/i, perDomain: "module", label: "module" },
];

function slugifyPackName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isRepeatingFile(file: ScanFile): boolean {
  const ph = new Set(file.placeholders);
  return ph.has("{nn}") && ph.has("{slug}");
}

function hasNamedHeading(file: ScanFile): boolean {
  return file.headings.some((h) => h.depth <= 2 && /\{name\}/i.test(h.text));
}

function fileSignals(file: ScanFile): string[] {
  const signals: string[] = [];
  if (isRepeatingFile(file)) signals.push("repeating-candidate");
  if (hasNamedHeading(file)) signals.push("named-heading");
  if (file.placeholders.includes("{lang}")) signals.push("locale-placeholder");
  if (/\bFR[-_]?\d*/i.test(file.relativePath) || file.placeholders.some((p) => /requirement/i.test(p))) {
    signals.push("atomic-requirements");
  }
  if (/detail|per-/i.test(file.relativePath)) signals.push("detail-filename");
  for (const v of VOCABULARY_PATTERNS) {
    if (v.re.test(file.relativePath) || file.headings.some((h) => v.re.test(h.text))) {
      signals.push(`vocabulary:${v.perDomain}`);
    }
  }
  return signals;
}

function digestFile(file: ScanFile): ScanFileDigest {
  return {
    relativePath: file.relativePath,
    headings: file.headings.slice(0, 8).map((h) => h.text),
    placeholders: file.placeholders,
    signals: fileSignals(file),
  };
}

function detectRepeatingCandidates(files: ScanFile[]): RepeatingCandidate[] {
  const out: RepeatingCandidate[] = [];
  for (const file of files) {
    if (!isRepeatingFile(file) && !hasNamedHeading(file)) continue;
    const evidence: string[] = [];
    if (isRepeatingFile(file)) evidence.push("placeholders {nn} and {slug}");
    if (hasNamedHeading(file)) {
      const h = file.headings.find((x) => /\{name\}/i.test(x.text));
      if (h) evidence.push(`heading "${h.text}"`);
    }
    let perDomainHint: string | null = null;
    for (const v of VOCABULARY_PATTERNS) {
      if (v.re.test(file.relativePath) || file.headings.some((h) => v.re.test(h.text))) {
        perDomainHint = v.perDomain;
        evidence.push(`vocabulary hint: ${v.label}`);
        break;
      }
    }
    out.push({ path: file.relativePath, perDomainHint, evidence });
  }
  return out;
}

function inferPurpose(files: ScanFile[], sourceDir: string): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("doc-purpose");
  const paths = files.map((f) => f.relativePath.toLowerCase()).join(" ");
  const headingText = files.flatMap((f) => f.headings.map((h) => h.text.toLowerCase())).join(" ");
  const evidence: string[] = [];
  const signals: string[] = [];

  if (/\bsrs\b|requirements|functional requirement/i.test(paths + headingText)) {
    aspect.proposal = "SRS";
    aspect.status = "inferred";
    aspect.confidence = "medium";
    evidence.push("SRS-like paths or headings");
    signals.push("purpose:srs");
  } else if (/basic[-_ ]?design|wireframe|screen list/i.test(paths + headingText)) {
    aspect.proposal = "basic-design";
    aspect.status = "inferred";
    aspect.confidence = "medium";
    evidence.push("basic-design-like paths or headings");
    signals.push("purpose:basic-design");
  } else if (/\badr\b|architecture decision|arc42/i.test(paths + headingText)) {
    aspect.proposal = "ADR";
    aspect.status = "inferred";
    aspect.confidence = "medium";
    evidence.push("ADR/arc42-like paths or headings");
    signals.push("purpose:adr");
  } else if (files.length > 0) {
    aspect.status = "unknown";
    evidence.push(`scanned ${files.length} files under ${basename(sourceDir)}`);
  }

  aspect.scanEvidence = evidence;
  aspect.scanSignals = signals;
  return aspect;
}

function inferDocShape(repeating: RepeatingCandidate[]): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("doc-shape");
  if (repeating.length === 0) {
    aspect.status = "resolved";
    aspect.proposal = { repeating: [], single: "all files" };
    aspect.scanEvidence = ["no {nn}/{slug} or named-heading repeating signals"];
    aspect.scanSignals = ["shape:all-single"];
    return aspect;
  }
  aspect.proposal = {
    repeating: repeating.map((r) => r.path),
    single: "other files",
  };
  aspect.status = "inferred";
  aspect.confidence = repeating.every((r) => r.perDomainHint) ? "high" : "medium";
  aspect.scanEvidence = repeating.flatMap((r) => r.evidence.map((e) => `${r.path}: ${e}`));
  aspect.scanSignals = ["shape:repeating-detected"];
  return aspect;
}

function inferVocabulary(repeating: RepeatingCandidate[]): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("domain-vocabulary");
  if (repeating.length === 0) {
    aspect.status = "resolved";
    aspect.proposal = null;
    aspect.scanEvidence = ["no repeating files — vocabulary N/A"];
    aspect.scanSignals = ["vocabulary:na"];
    return aspect;
  }
  const hints = [...new Set(repeating.map((r) => r.perDomainHint).filter(Boolean))] as string[];
  if (hints.length === 1) {
    aspect.proposal = hints[0];
    aspect.status = "inferred";
    aspect.confidence = "high";
    aspect.scanEvidence = repeating.map((r) => `${r.path} → ${r.perDomainHint}`);
    aspect.scanSignals = ["vocabulary:single-hint"];
  } else if (hints.length > 1) {
    aspect.proposal = hints;
    aspect.status = "ambiguous";
    aspect.confidence = "low";
    aspect.scanEvidence = repeating.map((r) => `${r.path}: ${r.perDomainHint ?? "unknown"}`);
    aspect.scanSignals = ["vocabulary:conflict"];
  } else {
    aspect.status = "unknown";
    aspect.scanEvidence = repeating.map((r) => r.path);
    aspect.scanSignals = ["vocabulary:missing"];
  }
  return aspect;
}

function inferListDetailPairs(files: ScanFile[], repeating: RepeatingCandidate[]): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("list-detail-pairs");
  if (repeating.length === 0) {
    aspect.status = "resolved";
    aspect.proposal = {};
    aspect.scanEvidence = ["no repeating files"];
    return aspect;
  }
  const pairs: Record<string, string> = {};
  const evidence: string[] = [];
  for (const rep of repeating) {
    const base = rep.path.replace(/-detail\.md$/i, "s.md").replace(/detail\.md$/i, "s.md");
    const listCandidate = files.find(
      (f) =>
        f.relativePath !== rep.path &&
        (f.relativePath === base ||
          f.relativePath.replace(/s\.md$/i, "") === rep.path.replace(/-detail\.md$/i, "")),
    );
    if (listCandidate) {
      const key = rep.perDomainHint ?? rep.path;
      pairs[key] = listCandidate.relativePath;
      evidence.push(`${listCandidate.relativePath} lists items for ${rep.path}`);
    }
  }
  if (Object.keys(pairs).length === repeating.length && repeating.length > 0) {
    aspect.proposal = pairs;
    aspect.status = "inferred";
    aspect.confidence = "high";
  } else if (Object.keys(pairs).length > 0) {
    aspect.proposal = pairs;
    aspect.status = "ambiguous";
    aspect.confidence = "medium";
    evidence.push("some repeating files lack a clear list partner");
  } else {
    aspect.status = "unknown";
    evidence.push("could not pair list and detail files from names");
  }
  aspect.scanEvidence = evidence;
  aspect.scanSignals = ["list-detail:heuristic"];
  return aspect;
}

function inferPackIdentity(sourceDir: string): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("pack-identity");
  const folder = basename(sourceDir);
  const slug = slugifyPackName(folder);
  if (slug.length >= 2) {
    aspect.proposal = slug;
    aspect.status = /[A-Z\s]/.test(folder) ? "ambiguous" : "inferred";
    aspect.confidence = /[A-Z\s]/.test(folder) ? "low" : "medium";
    aspect.scanEvidence = [`source folder: ${folder}`];
    aspect.scanSignals = ["pack-identity:folder-name"];
  } else {
    aspect.status = "unknown";
    aspect.scanEvidence = [`source folder "${folder}" did not yield a slug`];
  }
  return aspect;
}

function inferOutputRouting(files: ScanFile[], sourceDir: string): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("output-routing");
  const topDirs = [...new Set(files.map((f) => f.relativePath.split("/")[0]).filter(Boolean))];
  if (topDirs.length === 1 && topDirs[0] !== undefined) {
    const root = `docs/${topDirs[0]}/`;
    aspect.proposal = root;
    aspect.status = "inferred";
    aspect.confidence = "medium";
    aspect.scanEvidence = [`templates grouped under ${topDirs[0]}/`, `source: ${basename(sourceDir)}`];
    aspect.scanSignals = ["output:mirror-top-folder"];
  } else if (files.some((f) => f.relativePath.toLowerCase().startsWith("srs/"))) {
    aspect.proposal = "docs/srs/";
    aspect.status = "inferred";
    aspect.confidence = "medium";
    aspect.scanEvidence = ["templates under srs/"];
    aspect.scanSignals = ["output:srs-folder"];
  } else {
    aspect.status = "unknown";
    aspect.scanEvidence = [`${files.length} files without a single top-level folder`];
  }
  return aspect;
}

function inferStandards(files: ScanFile[]): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("standards-alignment");
  const blob = files
    .flatMap((f) => [f.relativePath, ...f.headings.map((h) => h.text)])
    .join(" ")
    .toLowerCase();
  const standards: string[] = [];
  const evidence: string[] = [];
  if (/29148|ieee|functional requirement/i.test(blob)) {
    standards.push("ISO-29148");
    evidence.push("ISO/IEEE requirement-style headings");
  }
  if (/arc42|architecture documentation/i.test(blob)) {
    standards.push("arc42");
    evidence.push("arc42-style sections");
  }
  if (standards.length > 0) {
    aspect.proposal = standards;
    aspect.status = "inferred";
    aspect.confidence = "medium";
  } else {
    aspect.proposal = ["team-internal"];
    aspect.status = "inferred";
    aspect.confidence = "low";
    evidence.push("no explicit standard keywords — defaulting to team-internal");
  }
  aspect.scanEvidence = evidence;
  aspect.scanSignals = ["standards:keyword-scan"];
  return aspect;
}

function inferRequirementsModel(files: ScanFile[]): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("requirements-model");
  const hasAtomic = files.some(
    (f) =>
      /\bFR[-_]/i.test(f.relativePath) ||
      f.placeholders.some((p) => /requirement/i.test(p)) ||
      f.headings.some((h) => /functional requirement|non-functional/i.test(h.text)),
  );
  if (hasAtomic) {
    aspect.proposal = "atomic";
    aspect.status = "inferred";
    aspect.confidence = "medium";
    aspect.scanEvidence = ["FR/NFR or requirement placeholders detected"];
    aspect.scanSignals = ["requirements:atomic"];
  } else {
    aspect.proposal = "narrative";
    aspect.status = "inferred";
    aspect.confidence = "low";
    aspect.scanEvidence = ["no FR/NFR patterns — treating as narrative docs"];
    aspect.scanSignals = ["requirements:narrative"];
  }
  return aspect;
}

function inferLocale(files: ScanFile[]): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("locale-strategy");
  const hasLang = files.some((f) => f.placeholders.includes("{lang}") || f.relativePath.includes("{lang}"));
  if (hasLang) {
    aspect.proposal = "multi";
    aspect.status = "inferred";
    aspect.confidence = "high";
    aspect.scanEvidence = ["{lang} in template paths or placeholders"];
    aspect.scanSignals = ["locale:multi"];
  } else {
    aspect.proposal = "single";
    aspect.status = "resolved";
    aspect.scanEvidence = ["no {lang} placeholders"];
    aspect.scanSignals = ["locale:single"];
  }
  return aspect;
}

function inferGraphSeeds(repeating: RepeatingCandidate[]): ImportAspectCoverage {
  const aspect = emptyAspectCoverage("graph-seeds");
  if (repeating.length === 0) {
    aspect.status = "resolved";
    aspect.proposal = [];
    aspect.scanEvidence = ["no repeating files — graph domain nodes not required for breakout"];
    aspect.scanSignals = ["graph:na"];
    return aspect;
  }
  const domains = [...new Set(repeating.map((r) => r.perDomainHint).filter(Boolean))] as string[];
  if (domains.length === 0) {
    aspect.status = "unknown";
    aspect.scanEvidence = repeating.map((r) => r.path);
    aspect.scanSignals = ["graph:unknown-domain"];
    return aspect;
  }
  const nonBuiltin = domains.filter((d) => !BUILTIN_GRAPH_DOMAIN_TYPES.has(d));
  aspect.proposal = domains;
  aspect.status = nonBuiltin.length > 0 ? "ambiguous" : "inferred";
  aspect.confidence = nonBuiltin.length > 0 ? "medium" : "high";
  aspect.scanEvidence = [
    `perDomain candidates: ${domains.join(", ")}`,
    ...(nonBuiltin.length > 0
      ? [`non-builtin types (${nonBuiltin.join(", ")}) need manual breakout workflow`]
      : []),
  ];
  aspect.scanSignals = ["graph:per-domain"];
  return aspect;
}

const INFERERS: Record<
  ImportAspectId,
  (ctx: {
    files: ScanFile[];
    sourceDir: string;
    repeating: RepeatingCandidate[];
  }) => ImportAspectCoverage
> = {
  "doc-purpose": ({ files, sourceDir }) => inferPurpose(files, sourceDir),
  "doc-shape": ({ repeating }) => inferDocShape(repeating),
  "domain-vocabulary": ({ repeating }) => inferVocabulary(repeating),
  "list-detail-pairs": ({ files, repeating }) => inferListDetailPairs(files, repeating),
  "pack-identity": ({ sourceDir }) => inferPackIdentity(sourceDir),
  "output-routing": ({ files, sourceDir }) => inferOutputRouting(files, sourceDir),
  "standards-alignment": ({ files }) => inferStandards(files),
  "requirements-model": ({ files }) => inferRequirementsModel(files),
  "locale-strategy": ({ files }) => inferLocale(files),
  "graph-seeds": ({ repeating }) => inferGraphSeeds(repeating),
};

function detectSupplementalQuestions(
  scan: ScanResult,
  repeating: RepeatingCandidate[],
  aspectCoverage: ImportAspectCoverage[],
): ImportSupplementalQuestion[] {
  const questions: ImportSupplementalQuestion[] = [];

  const topDirs = [...new Set(scan.files.map((f) => f.relativePath.split("/")[0]).filter(Boolean))];
  if (topDirs.length > 1) {
    questions.push({
      id: "scan:multi-root-folders",
      scanTrigger: `Templates span multiple top folders: ${topDirs.join(", ")}`,
      neededFor: ["manifest structure", "output-routing"],
      status: "open",
    });
  }

  for (const rep of repeating.filter((r) => !r.perDomainHint)) {
    questions.push({
      id: `scan:repeating-vocab:${rep.path}`,
      scanTrigger: `${rep.path} looks repeating (${rep.evidence.join("; ")}) but domain noun is unclear`,
      neededFor: ["domain-vocabulary", "perDomain", "outputPattern"],
      status: "open",
    });
  }

  const unusual = new Map<string, string[]>();
  for (const file of scan.files) {
    for (const ph of file.placeholders) {
      if (!COMMON_PLACEHOLDERS.has(ph)) {
        const list = unusual.get(ph) ?? [];
        list.push(file.relativePath);
        unusual.set(ph, list);
      }
    }
  }
  for (const [placeholder, paths] of unusual) {
    questions.push({
      id: `scan:placeholder:${placeholder.replace(/[{}]/g, "")}`,
      scanTrigger: `Uncommon placeholder ${placeholder} in ${paths.slice(0, 3).join(", ")}${paths.length > 3 ? "…" : ""}`,
      neededFor: ["context-map.json", "generate placeholders"],
      status: "open",
    });
  }

  for (const file of scan.files) {
    if (file.headings.length === 0) {
      questions.push({
        id: `scan:no-headings:${file.relativePath}`,
        scanTrigger: `${file.relativePath} has no headings — hard to derive readiness criteria`,
        neededFor: ["readiness-criteria.json", "pack-context"],
        status: "open",
      });
    }
  }

  const graphAspect = aspectCoverage.find((a) => a.aspectId === "graph-seeds");
  const domains = (graphAspect?.proposal as string[] | undefined) ?? [];
  const nonBuiltin = domains.filter((d) => !BUILTIN_GRAPH_DOMAIN_TYPES.has(d));
  if (nonBuiltin.length > 0) {
    questions.push({
      id: "scan:non-builtin-perdomain",
      scanTrigger: `perDomain types ${nonBuiltin.join(", ")} are not first-class in generate — manual breakout wave required`,
      neededFor: ["generate-hints.md", "user expectations"],
      status: "open",
    });
  }

  return questions;
}

/** Derive import aspect coverage from a template scan (no scan algorithm changes). */
export function buildScanInference(
  scan: ScanResult,
  _projectContext?: ScanInferenceProjectContext,
): ScanInferenceResult {
  const files = scan.files;
  const scanDigest = files.map(digestFile);
  const repeatingCandidates = detectRepeatingCandidates(files);
  const ctx = { files, sourceDir: scan.sourceDir, repeating: repeatingCandidates };

  const aspectCoverage = IMPORT_ASPECT_IDS.map((id) => INFERERS[id](ctx));
  const supplementalQuestions = detectSupplementalQuestions(scan, repeatingCandidates, aspectCoverage);

  return { aspectCoverage, scanDigest, repeatingCandidates, supplementalQuestions };
}

export function validateStagedGenerateSkill(text: string): { ok: boolean; missing: string[] } {
  const patterns = [
    { name: "task_list", re: /task_list/i },
    { name: "readiness-criteria", re: /readiness-criteria/i },
    { name: "workflow-setup", re: /workflow-setup/i },
    { name: "context-readiness", re: /context-readiness/i },
    { name: "generate-workflow", re: /generate-workflow/i },
    { name: "task_approve_plan", re: /task_approve_plan/i },
  ];
  const missing = patterns.filter((p) => !p.re.test(text)).map((p) => p.name);
  return { ok: missing.length === 0, missing };
}
