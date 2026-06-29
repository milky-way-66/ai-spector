import type { SyncClaudeResult } from "@/core/operations/sync-claude.js";
import type { SyncCursorResult } from "@/core/operations/sync-cursor.js";
import type { HooksInstallResult } from "@/core/operations/hooks.js";
import type { PreCommitReport } from "@/core/operations/hooks.js";
import { WRITER_LIFECYCLE_HANDOFF } from "@/core/docops/lifecycle.js";
import type { SetupAudit } from "@/core/operations/setup.js";
import type { LangAddResult, LangSetClientResult, LangSetInternalResult } from "@/core/operations/lang.js";
import type { QueueScanResult } from "@/core/operations/lang-queue.js";
import type { ResolveTaskResult } from "@/core/operations/resolve-task.js";

export function formatSyncCursor(result: SyncCursorResult): string {
  return [
    `Synced Cursor bundle at ${result.cursorDir}`,
    `  source → ${result.sourceDir}`,
    "",
    "Reload Cursor skills if needed; see .cursor/WORKFLOW.md",
  ].join("\n");
}

export function formatSyncClaude(result: SyncClaudeResult): string {
  return [
    `Synced Claude bundle at ${result.claudeSkillsDir}`,
    `  CLAUDE.md → ${result.claudeMd}`,
    `  source → ${result.sourceDir}`,
    "",
    "Reload MCP if needed; skills load from .claude/skills/ — see WORKFLOW.md",
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

export { formatPreCommitReport } from "@/core/operations/hooks.js";

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
    if (audit.ready) {
      lines.push("", WRITER_LIFECYCLE_HANDOFF);
    }
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

export function formatLangSetClient(result: LangSetClientResult): string {
  const prev =
    result.previousCode && result.previousCode !== result.code
      ? ` (was ${result.previousCode})`
      : result.previousCode === result.code
        ? " (unchanged)"
        : "";
  return `Client language preference: ${result.label} (${result.code})${prev}`;
}

export function formatLangSetInternal(result: LangSetInternalResult): string {
  const prev =
    result.previousCode && result.previousCode !== result.code
      ? ` (was ${result.previousCode})`
      : result.previousCode === result.code
        ? " (unchanged)"
        : "";
  return `Internal language preference: ${result.label} (${result.code})${prev}`;
}

export function formatQueueScan(result: QueueScanResult): string {
  if (result.skipped) return `Translation queue: skipped (${result.skipReason})`;
  return `Translation queue: ${result.pendingCount} pending, +${result.enqueued} enqueued, ${result.resolved} resolved, ${result.failed} failed`;
}

export function formatResolveTask(result: ResolveTaskResult): string {
  const { plan, execution, stateUpdate, status } = result;
  const lines: string[] = [];

  const statusIcon = status === "complete" ? "✓" : status === "blocked" ? "✗" : "~";
  lines.push(`${statusIcon} Task ${plan.id} — ${status.toUpperCase()}`);
  lines.push(`  goal: ${plan.goal.trigger}`);
  lines.push(`  domain: ${plan.goal.domain}  risk: ${plan.riskLevel}`);
  lines.push("");

  lines.push("Steps:");
  for (const step of plan.steps) {
    const s = execution.steps.find((r) => r.stepId === step.id);
    const icon = s?.status === "done" ? "✓" : s?.status === "blocked" ? "✗" : "○";
    lines.push(`  ${icon} [${step.id}] ${step.description}`);
    if (s?.issue) lines.push(`      blocked: ${s.issue}`);
    if (s?.artifacts.length) lines.push(`      wrote: ${s.artifacts.join(", ")}`);
  }

  lines.push("");
  lines.push("State update:");
  lines.push(`  reindexed: ${stateUpdate.reindexed.length} file(s)`);
  lines.push(
    `  graph diff: +${stateUpdate.graphDiff.added} -${stateUpdate.graphDiff.removed} ~${stateUpdate.graphDiff.modified}`,
  );
  if (stateUpdate.commitSha) lines.push(`  commit: ${stateUpdate.commitSha}`);
  lines.push(`  ${stateUpdate.summary}`);

  if (execution.issues.length) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of execution.issues) lines.push(`  ! ${issue}`);
  }

  return lines.join("\n");
}
