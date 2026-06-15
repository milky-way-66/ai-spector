import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { resolveAuditActor } from "../util/audit-actor.js";
import type { AuditActorRole } from "../util/audit-actor.js";

export type ContextEntryStatus = "open" | "answered" | "stale";
export type ContextEntrySource = "user" | "inferred" | "data-source";

export interface ContextEntry {
  id: string;
  question: string;
  answer?: string;
  status: ContextEntryStatus;
  /** DAG node / section this informs, e.g. "srs.use-cases". */
  scope?: string;
  source: ContextEntrySource;
  /** Files (relative to root) whose change makes this entry stale. */
  sourceRefs?: string[];
  createdAt: string;
  answeredAt?: string;
  /** Answerer email. */
  answeredBy?: string;
  answeredByUsername?: string;
  answeredByRole?: AuditActorRole;
}

export interface ContextStore {
  version: number;
  docType: string;
  entries: ContextEntry[];
}

// ── list ──────────────────────────────────────────────────────────────────────

export interface ContextListOptions {
  root?: string;
  /** Doc type to list. Omit to list all stores. */
  docType?: string;
  status?: ContextEntryStatus;
}

export interface ContextListResult {
  stores: ContextStore[];
  total: number;
}

// ── record ────────────────────────────────────────────────────────────────────

export interface ContextRecordOptions {
  root?: string;
  docType: string;
  question: string;
  /** Provide to record an already-answered clarification in one step. */
  answer?: string;
  scope?: string;
  source?: ContextEntrySource;
  sourceRefs?: string[];
  answeredBy?: string;
  answeredByUsername?: string;
  role?: AuditActorRole;
}

export interface ContextRecordResult {
  docType: string;
  entry: ContextEntry;
  storePath: string;
}

// ── resolve ───────────────────────────────────────────────────────────────────

export interface ContextResolveOptions {
  root?: string;
  docType: string;
  id: string;
  answer: string;
  answeredBy?: string;
  answeredByUsername?: string;
  role?: AuditActorRole;
}

export interface ContextResolveResult {
  docType: string;
  entry: ContextEntry;
  storePath: string;
}

// ── stale scan ────────────────────────────────────────────────────────────────

export interface ContextStaleScanOptions {
  root?: string;
  docType?: string;
}

export interface ContextStaleScanResult {
  /** Doc types whose stores were scanned. */
  docTypes: string[];
  /** Answered entries whose sourceRefs were checked. */
  checked: number;
  /** Entries flipped from "answered" to "stale" in this run. */
  markedStale: number;
  /** Total entries currently stale (including previously stale). */
  staleTotal: number;
}

// ── store IO ──────────────────────────────────────────────────────────────────

function contextDir(root: string): string {
  return join(root, ".ai-spector/.docflow/context");
}

export function contextStorePath(root: string, docType: string): string {
  return join(contextDir(root), `${docType}.json`);
}

async function resolveRoot(root?: string): Promise<string> {
  const loaded = await loadDocflowConfig(root ? resolve(root) : undefined);
  return loaded.root;
}

async function loadStore(root: string, docType: string): Promise<ContextStore> {
  const path = contextStorePath(root, docType);
  if (await pathExists(path)) {
    return readJson<ContextStore>(path);
  }
  return { version: 1, docType, entries: [] };
}

async function saveStore(root: string, store: ContextStore): Promise<string> {
  const path = contextStorePath(root, store.docType);
  await mkdir(dirname(path), { recursive: true });
  await writeJson(path, store);
  return path;
}

function nextId(store: ContextStore): string {
  let max = 0;
  for (const e of store.entries) {
    const m = /^Q-(\d+)$/.exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Q-${String(max + 1).padStart(3, "0")}`;
}

// ── operations ────────────────────────────────────────────────────────────────

export async function runContextList(
  opts: ContextListOptions = {},
): Promise<ContextListResult> {
  const root = await resolveRoot(opts.root);
  const dir = contextDir(root);
  let docTypes: string[] = [];
  if (opts.docType) {
    docTypes = [opts.docType];
  } else if (await pathExists(dir)) {
    docTypes = (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length));
  }

  const stores: ContextStore[] = [];
  for (const docType of docTypes) {
    const store = await loadStore(root, docType);
    const entries = opts.status
      ? store.entries.filter((e) => e.status === opts.status)
      : store.entries;
    if (opts.docType || entries.length > 0) {
      stores.push({ ...store, entries });
    }
  }
  return { stores, total: stores.reduce((n, s) => n + s.entries.length, 0) };
}

export async function runContextRecord(
  opts: ContextRecordOptions,
): Promise<ContextRecordResult> {
  if (!opts.docType) throw new Error("docType is required");
  if (!opts.question?.trim()) throw new Error("question is required");

  const root = await resolveRoot(opts.root);
  const store = await loadStore(root, opts.docType);
  const now = new Date().toISOString();
  const answered = opts.answer !== undefined && opts.answer.trim() !== "";

  const entry: ContextEntry = {
    id: nextId(store),
    question: opts.question.trim(),
    status: answered ? "answered" : "open",
    source: opts.source ?? "user",
    createdAt: now,
    ...(answered ? { answer: opts.answer!.trim(), answeredAt: now } : {}),
    ...(opts.scope ? { scope: opts.scope } : {}),
    ...(opts.sourceRefs?.length ? { sourceRefs: opts.sourceRefs } : {}),
  };

  if (answered) {
    const actor = await resolveAuditActor(root, {
      by: opts.answeredBy,
      username: opts.answeredByUsername,
      role: opts.role,
    });
    entry.answeredBy = actor.by;
    entry.answeredByUsername = actor.username;
    entry.answeredByRole = actor.role;
  }

  store.entries.push(entry);
  const storePath = await saveStore(root, store);
  return { docType: opts.docType, entry, storePath };
}

/**
 * Flip answered entries to "stale" when any of their sourceRefs changed on
 * disk after the answer was recorded (mtime > answeredAt). A missing ref also
 * counts as stale — the answer was grounded in a file that no longer exists.
 */
export async function runContextStaleScan(
  opts: ContextStaleScanOptions = {},
): Promise<ContextStaleScanResult> {
  const root = await resolveRoot(opts.root);
  const dir = contextDir(root);
  let docTypes: string[] = [];
  if (opts.docType) {
    docTypes = [opts.docType];
  } else if (await pathExists(dir)) {
    docTypes = (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length));
  }

  let checked = 0;
  let markedStale = 0;
  let staleTotal = 0;

  for (const docType of docTypes) {
    const store = await loadStore(root, docType);
    let dirty = false;
    for (const entry of store.entries) {
      if (entry.status === "stale") {
        staleTotal++;
        continue;
      }
      if (entry.status !== "answered" || !entry.sourceRefs?.length || !entry.answeredAt) {
        continue;
      }
      checked++;
      const answeredAtMs = Date.parse(entry.answeredAt);
      let stale = false;
      for (const ref of entry.sourceRefs) {
        try {
          const info = await stat(join(root, ref));
          if (info.mtimeMs > answeredAtMs) {
            stale = true;
            break;
          }
        } catch {
          stale = true;
          break;
        }
      }
      if (stale) {
        entry.status = "stale";
        dirty = true;
        markedStale++;
        staleTotal++;
      }
    }
    if (dirty) {
      await saveStore(root, store);
    }
  }

  return { docTypes, checked, markedStale, staleTotal };
}

export async function runContextResolve(
  opts: ContextResolveOptions,
): Promise<ContextResolveResult> {
  if (!opts.answer?.trim()) throw new Error("answer is required");

  const root = await resolveRoot(opts.root);
  const store = await loadStore(root, opts.docType);
  const entry = store.entries.find((e) => e.id === opts.id);
  if (!entry) {
    throw new Error(`No context entry "${opts.id}" in store for docType "${opts.docType}"`);
  }

  entry.answer = opts.answer.trim();
  entry.status = "answered";
  entry.answeredAt = new Date().toISOString();
  const actor = await resolveAuditActor(root, {
    by: opts.answeredBy,
    username: opts.answeredByUsername,
    role: opts.role,
  });
  entry.answeredBy = actor.by;
  entry.answeredByUsername = actor.username;
  entry.answeredByRole = actor.role;

  const storePath = await saveStore(root, store);
  return { docType: opts.docType, entry, storePath };
}
