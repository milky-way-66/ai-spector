import type { AnalyzePrepResult } from "../../../commands/analyze.js";
import type { SyncCursorResult } from "../../../commands/sync-cursor.js";
import type { HooksInstallResult } from "../../../commands/hooks.js";
import type { PreCommitReport } from "../../../commands/hooks.js";
import type { SetupAudit } from "../../../commands/setup.js";
import type { LangAddResult } from "../../../commands/lang.js";
import type { QueueScanResult } from "../../../commands/lang-queue.js";

export function formatAnalyzePrep(result: AnalyzePrepResult): string {
  const lines = [
    `Graph structure ready: ${result.documentCount} documents, ${result.sectionCount} sections`,
    `  registry → ${result.registryPath}`,
    `  graph    → ${result.graphPath}`,
    `  (entity extraction did not run — domain nodes are not created here)`,
    "",
  ];
  if (result.merged) lines.push("", "Merged domain knowledge into graph.");
  else lines.push("Next: in Cursor ask the agent to 'analyze the data source'");
  return lines.join("\n");
}

export function formatSyncCursor(result: SyncCursorResult): string {
  return [
    `Synced Cursor bundle at ${result.cursorDir}`,
    `  source → ${result.sourceDir}`,
    "",
    "Reload Cursor skills if needed; see .cursor/WORKFLOW.md",
  ].join("\n");
}

export function formatHooksInstall(result: HooksInstallResult): string {
  const lines: string[] = [];
  if (result.gitInitialized) lines.push(`Initialized git repository`);
  lines.push(`Installed pre-commit hook: ${result.hookPath}`);
  lines.push("Checks on staged docs/graph: graph validate (blocks), translation queue + impact (warn).");
  lines.push("Strict warnings: npx ai-spector hooks pre-commit --strict");
  lines.push("Bypass once: git commit --no-verify");
  return lines.join("\n");
}

export { formatPreCommitReport } from "../../../commands/hooks.js";

export function formatSetupAudit(audit: SetupAudit, afterSetup = false): string {
  const lines = ["Setup checklist", ""];
  for (const step of audit.steps) {
    const icon = step.status === "ok" ? "✓" : step.status === "warning" ? "!" : "✗";
    const detail = step.detail ? ` — ${step.detail}` : "";
    lines.push(`  ${icon} ${step.label}${detail}`);
    if (step.status !== "ok" && step.fix) lines.push(`      fix: ${step.fix}`);
  }
  lines.push("", audit.ready ? "Project is ready for the docflow pipeline." : "Some required steps are missing.");
  if (afterSetup) {
    lines.push("", "Cursor IDE (do once):");
    lines.push("  1. Open this folder in Cursor");
    lines.push("  2. Settings → Rules → enable all skills under .cursor/skills/");
    lines.push("  3. Reload MCP if .cursor/mcp.json changed");
    lines.push("  4. Add source files to docs/data-source/");
    lines.push('  5. In chat: "setup complete — analyze my data source"');
    lines.push("", "Re-check anytime: npx ai-spector setup --check");
  }
  return lines.join("\n");
}

export function formatLangAdd(result: LangAddResult): string {
  if (result.alreadyExists) return `Language "${result.code}" is already configured.`;
  const lines = [
    `Added language: ${result.label} (${result.code})`,
    `  docs/srs/${result.code}/`,
    `  docs/basic-design/${result.code}/`,
    `  translationOf edges registered in graph`,
  ];
  if (result.queuePending !== undefined) {
    lines.push(`  translation queue: ${result.queuePending} pending, +${result.queueEnqueued} enqueued`);
  }
  lines.push(`Run 'npx ai-spector index' to refresh the full graph.`);
  return lines.join("\n");
}

export function formatQueueScan(result: QueueScanResult): string {
  if (result.skipped) return `Translation queue: skipped (${result.skipReason})`;
  return `Translation queue: ${result.pendingCount} pending, +${result.enqueued} enqueued, ${result.resolved} resolved, ${result.failed} failed`;
}
