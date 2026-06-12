import type {
  ContextEntry,
  ContextListResult,
  ContextRecordResult,
  ContextResolveResult,
} from "../../../core/operations/context.js";

function statusIcon(status: ContextEntry["status"]): string {
  if (status === "answered") return "✓";
  if (status === "stale") return "↻";
  return "?";
}

function formatEntry(e: ContextEntry): string {
  const lines: string[] = [`  [${statusIcon(e.status)} ${e.status}] ${e.id}: ${e.question}`];
  if (e.answer) lines.push(`      answer: ${e.answer}`);
  if (e.scope) lines.push(`      scope:  ${e.scope}`);
  if (e.sourceRefs?.length) lines.push(`      refs:   ${e.sourceRefs.join(", ")}`);
  if (e.answeredAt) {
    lines.push(`      by ${e.answeredBy ?? "unknown"} at ${e.answeredAt.slice(0, 10)}`);
  }
  return lines.join("\n");
}

export function formatContextList(result: ContextListResult): string {
  if (result.total === 0) return "No context entries recorded.";
  const lines: string[] = [];
  for (const store of result.stores) {
    lines.push(`${store.docType} (${store.entries.length})`);
    for (const e of store.entries) lines.push(formatEntry(e));
  }
  lines.push("");
  lines.push(`${result.total} entr${result.total === 1 ? "y" : "ies"} total`);
  return lines.join("\n");
}

export function formatContextRecord(result: ContextRecordResult): string {
  return [
    `Recorded ${result.entry.id} in ${result.docType} context (${result.entry.status}).`,
    formatEntry(result.entry),
  ].join("\n");
}

export function formatContextResolve(result: ContextResolveResult): string {
  return [
    `Resolved ${result.entry.id} in ${result.docType} context.`,
    formatEntry(result.entry),
  ].join("\n");
}
