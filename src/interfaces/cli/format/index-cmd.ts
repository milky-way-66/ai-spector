import type { IndexReport } from "@/core/operations/index.js";

export function formatIndexReport(report: IndexReport): string {
  const lines: string[] = ["", "Index refresh summary", "─────────────────────"];
  for (const s of report.steps) {
    const icon = s.status === "ok" ? "✓" : s.status === "skipped" ? "○" : "✗";
    lines.push(`  ${icon} ${s.label}: ${s.status}`);
    if (s.detail) {
      for (const line of s.detail.split("\n")) lines.push(`      ${line}`);
    }
  }
  if (report.cocoindexUpdated) {
    lines.push("  ✓ CocoIndex: embeddings updated");
  } else if (report.cocoindexSkipped === false) {
    lines.push("  ○ CocoIndex: skipped (not configured — run: npx ai-spector cocoindex setup)");
  }

  lines.push("");
  if (report.failed) {
    lines.push("Some steps failed. Graph/knowledge may be partially updated.");
    lines.push("Re-run after fixing, or use flags: --skip-merge, --graph-only");
  } else {
    lines.push("All requested steps completed.");
  }
  if (report.nextAction) {
    lines.push("", `Next: ${report.nextAction}`);
  }
  return lines.join("\n");
}
