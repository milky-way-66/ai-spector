import type {
  ExtractedSpec,
  SpecApproveResult,
  SpecListResult,
  SpecRecordResult,
  SpecRejectResult,
} from "@/core/operations/extracted.js";

function statusIcon(status: ExtractedSpec["status"]): string {
  if (status === "approved") return "✓";
  if (status === "rejected") return "✗";
  return "•";
}

function formatSpec(s: ExtractedSpec): string {
  const lines: string[] = [`  [${statusIcon(s.status)} ${s.status}] ${s.id}: ${s.statement}`];
  if (s.extractedFrom.length) lines.push(`      from:  ${s.extractedFrom.join(", ")}`);
  if (s.patch) {
    lines.push(`      patch: ${s.patch.nodes.length} node(s), ${s.patch.edges.length} edge(s)`);
  }
  if (s.reviewedAt) {
    const who =
      s.reviewedByUsername && s.reviewedBy
        ? `${s.reviewedByUsername} <${s.reviewedBy}>`
        : (s.reviewedBy ?? "unknown");
    lines.push(`      reviewed by ${who} at ${s.reviewedAt.slice(0, 10)}`);
  }
  if (s.note) lines.push(`      note:  ${s.note}`);
  return lines.join("\n");
}

export function formatSpecList(result: SpecListResult): string {
  if (result.total === 0) return "No extracted specs recorded.";
  const lines: string[] = [];
  for (const store of result.stores) {
    lines.push(`${store.docType} (${store.specs.length})`);
    for (const s of store.specs) lines.push(formatSpec(s));
  }
  lines.push("");
  lines.push(`${result.total} spec(s) total`);
  return lines.join("\n");
}

export function formatSpecRecord(result: SpecRecordResult): string {
  const lines = [
    `Recorded ${result.recorded.length} pending spec(s) in ${result.docType} queue.`,
  ];
  for (const s of result.recorded) lines.push(formatSpec(s));
  lines.push(`Review with: ai-spector spec list -t ${result.docType} -s pending`);
  return lines.join("\n");
}

export function formatSpecApprove(result: SpecApproveResult): string {
  const lines = [`Approved ${result.spec.id} (${result.docType}).`, formatSpec(result.spec)];
  if (result.merge) {
    const st = result.merge.stats;
    lines.push(
      `Graph merge: +${st.nodesCreated} node(s), ~${st.nodesUpdated} updated, +${st.edgesAdded} edge(s)` +
        (result.merge.validationOk === false ? " — VALIDATION ISSUES, run graph validate" : ""),
    );
  } else if (result.spec.patch) {
    lines.push("Graph merge skipped (--skip-merge).");
  }
  return lines.join("\n");
}

export function formatSpecReject(result: SpecRejectResult): string {
  return [`Rejected ${result.spec.id} (${result.docType}).`, formatSpec(result.spec)].join("\n");
}
