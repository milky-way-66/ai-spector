import { mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { runGraphMerge, type GraphMergeResult } from "./graph-merge.js";
import type { ExtractPatch } from "../graph/knowledge.js";
import type { WorkflowToolGuidance } from "../workflow/guidance.js";
import { buildSpecListWorkflowGuidance } from "../workflow/guidance.js";

export type SpecStatus = "pending" | "approved" | "rejected";

export interface ExtractedSpec {
  id: string;
  /** Short statement of the spec (decision, constraint, identifier, threshold). */
  statement: string;
  /** Generated document(s) the spec was extracted from (relative paths). */
  extractedFrom: string[];
  status: SpecStatus;
  /** Graph patch to merge on approval (nodes + edges). Optional — a spec may be informational only. */
  patch?: ExtractPatch;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** Reviewer note on approve/reject. */
  note?: string;
}

export interface SpecStore {
  version: number;
  docType: string;
  specs: ExtractedSpec[];
}

// ── options / results ─────────────────────────────────────────────────────────

export interface SpecListOptions {
  root?: string;
  docType?: string;
  status?: SpecStatus;
}

export interface SpecListResult {
  stores: SpecStore[];
  total: number;
  workflowGuidance: WorkflowToolGuidance;
}

export interface SpecRecordOptions {
  root?: string;
  docType: string;
  specs: Array<{
    statement: string;
    extractedFrom: string[];
    patch?: ExtractPatch;
  }>;
}

export interface SpecRecordResult {
  docType: string;
  recorded: ExtractedSpec[];
  storePath: string;
}

export interface SpecApproveOptions {
  root?: string;
  docType: string;
  id: string;
  by?: string;
  note?: string;
  /** Skip graph merge even when the spec has a patch (record-only approval). */
  skipMerge?: boolean;
}

export interface SpecApproveResult {
  docType: string;
  spec: ExtractedSpec;
  storePath: string;
  /** Present when the spec had a patch and merge ran. */
  merge?: GraphMergeResult;
}

export interface SpecRejectOptions {
  root?: string;
  docType: string;
  id: string;
  by?: string;
  note?: string;
}

export interface SpecRejectResult {
  docType: string;
  spec: ExtractedSpec;
  storePath: string;
}

// ── store IO ──────────────────────────────────────────────────────────────────

function extractedDir(root: string): string {
  return join(root, ".ai-spector/.docflow/extracted");
}

export function specStorePath(root: string, docType: string): string {
  return join(extractedDir(root), `${docType}.json`);
}

async function resolveRoot(root?: string): Promise<string> {
  const loaded = await loadDocflowConfig(root ? resolve(root) : undefined);
  return loaded.root;
}

async function loadStore(root: string, docType: string): Promise<SpecStore> {
  const path = specStorePath(root, docType);
  if (await pathExists(path)) {
    return readJson<SpecStore>(path);
  }
  return { version: 1, docType, specs: [] };
}

async function saveStore(root: string, store: SpecStore): Promise<string> {
  const path = specStorePath(root, store.docType);
  await mkdir(dirname(path), { recursive: true });
  await writeJson(path, store);
  return path;
}

function nextId(store: SpecStore): number {
  let max = 0;
  for (const s of store.specs) {
    const m = /^SPEC-(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function findSpec(store: SpecStore, docType: string, id: string): ExtractedSpec {
  const spec = store.specs.find((s) => s.id === id);
  if (!spec) {
    throw new Error(`No extracted spec "${id}" in store for docType "${docType}"`);
  }
  return spec;
}

// ── operations ────────────────────────────────────────────────────────────────

export async function runSpecList(opts: SpecListOptions = {}): Promise<SpecListResult> {
  const root = await resolveRoot(opts.root);
  const dir = extractedDir(root);
  let docTypes: string[] = [];
  if (opts.docType) {
    docTypes = [opts.docType];
  } else if (await pathExists(dir)) {
    docTypes = (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length));
  }

  const stores: SpecStore[] = [];
  for (const docType of docTypes) {
    const store = await loadStore(root, docType);
    const specs = opts.status
      ? store.specs.filter((s) => s.status === opts.status)
      : store.specs;
    if (opts.docType || specs.length > 0) {
      stores.push({ ...store, specs });
    }
  }
  return {
    stores,
    total: stores.reduce((n, s) => n + s.specs.length, 0),
    workflowGuidance: buildSpecListWorkflowGuidance(stores),
  };
}

export async function runSpecRecord(opts: SpecRecordOptions): Promise<SpecRecordResult> {
  if (!opts.docType) throw new Error("docType is required");
  if (!opts.specs?.length) throw new Error("at least one spec is required");

  const root = await resolveRoot(opts.root);
  const store = await loadStore(root, opts.docType);
  const now = new Date().toISOString();

  let seq = nextId(store);
  const recorded: ExtractedSpec[] = [];
  for (const input of opts.specs) {
    if (!input.statement?.trim()) throw new Error("spec statement is required");
    const spec: ExtractedSpec = {
      id: `SPEC-${String(seq++).padStart(3, "0")}`,
      statement: input.statement.trim(),
      extractedFrom: input.extractedFrom ?? [],
      status: "pending",
      createdAt: now,
      ...(input.patch ? { patch: input.patch } : {}),
    };
    store.specs.push(spec);
    recorded.push(spec);
  }

  const storePath = await saveStore(root, store);
  return { docType: opts.docType, recorded, storePath };
}

export async function runSpecApprove(opts: SpecApproveOptions): Promise<SpecApproveResult> {
  const root = await resolveRoot(opts.root);
  const store = await loadStore(root, opts.docType);
  const spec = findSpec(store, opts.docType, opts.id);
  if (spec.status === "approved") {
    throw new Error(`Spec "${spec.id}" is already approved`);
  }

  let merge: GraphMergeResult | undefined;
  if (spec.patch && !opts.skipMerge) {
    // Write the patch beside the store so the merge is auditable, then merge.
    const patchPath = join(extractedDir(root), `${opts.docType}.${spec.id}.patch.json`);
    await mkdir(dirname(patchPath), { recursive: true });
    await writeJson(patchPath, spec.patch);
    merge = await runGraphMerge({ root, inputPath: patchPath, validate: true });
  }

  spec.status = "approved";
  spec.reviewedAt = new Date().toISOString();
  if (opts.by) spec.reviewedBy = opts.by;
  if (opts.note) spec.note = opts.note;

  const storePath = await saveStore(root, store);
  return { docType: opts.docType, spec, storePath, ...(merge ? { merge } : {}) };
}

export async function runSpecReject(opts: SpecRejectOptions): Promise<SpecRejectResult> {
  const root = await resolveRoot(opts.root);
  const store = await loadStore(root, opts.docType);
  const spec = findSpec(store, opts.docType, opts.id);

  spec.status = "rejected";
  spec.reviewedAt = new Date().toISOString();
  if (opts.by) spec.reviewedBy = opts.by;
  if (opts.note) spec.note = opts.note;

  const storePath = await saveStore(root, store);
  return { docType: opts.docType, spec, storePath };
}
