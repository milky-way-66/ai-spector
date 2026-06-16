import type { AdoptPlan, AdoptScanResult, AdoptSetupState } from "@/core/adopt/types.js";
import type { AdoptValidationResult } from "@/core/adopt/validate.js";

export function formatAdoptScan(result: AdoptScanResult): string {
  const lines = [
    `Adopt scan — ${result.scannedAt}`,
    `  SRS:           ${result.classification.srs}`,
    `  Basic design:  ${result.classification.basicDesign}`,
    `  Prototype:     ${result.classification.prototype}`,
    `  Languages:     ${result.classification.languages.strategy} [${result.classification.languages.detected.join(", ") || "none"}]`,
    `  Data source:   ${result.classification.dataSource}`,
    `  Active pack:   ${result.classification.activePack}`,
    `  Inventory:     ${result.inventory.length} file(s)`,
  ];
  if (result.questionsForUser.length > 0) {
    lines.push("", "Questions for user:");
    for (const q of result.questionsForUser) {
      lines.push(`  [${q.id}]${q.blocking ? " (blocking)" : ""} ${q.prompt}`);
    }
  }
  return lines.join("\n");
}

export function formatAdoptPlan(plan: AdoptPlan): string {
  const lines = [
    `Adopt plan — status: ${plan.status}`,
    `  Moves:            ${plan.moves.length}`,
    `  Config patches:   ${plan.configPatches.length}`,
    `  Prototype actions:${plan.prototypeActions.length}`,
    `  Warnings:         ${plan.warnings.length}`,
    `  Blocking issues:  ${plan.blockingIssues.length}`,
  ];
  if (plan.approvedAt) {
    lines.push(`  Approved:         ${plan.approvedAt} by ${plan.approvedBy ?? "user"}`);
  }
  if (plan.blockingIssues.length > 0) {
    lines.push("", "Blocking issues:");
    for (const issue of plan.blockingIssues) {
      lines.push(`  - ${issue}`);
    }
  }
  if (plan.moves.length > 0 && plan.moves.length <= 10) {
    lines.push("", "Moves:");
    for (const move of plan.moves) {
      lines.push(`  ${move.from} → ${move.to} (${move.confidence})`);
    }
  } else if (plan.moves.length > 10) {
    lines.push("", `Moves: ${plan.moves.length} total (use --json for full list)`);
  }
  return lines.join("\n");
}

export function formatAdoptApply(result: {
  moved: number;
  dryRun: boolean;
  moves: Array<{ from: string; to: string }>;
}): string {
  if (result.dryRun) {
    return `Adopt apply (dry-run) — ${result.moves.length} move(s) planned, none executed.`;
  }
  return `Adopt apply — moved ${result.moved} file(s).`;
}

export function formatAdoptBootstrap(result: { steps: Array<{ id: string; status: string; detail?: string }> }): string {
  const lines = ["Adopt bootstrap — steps:"];
  for (const step of result.steps) {
    lines.push(`  [${step.status}] ${step.id}${step.detail ? `: ${step.detail}` : ""}`);
  }
  return lines.join("\n");
}

export function formatAdoptValidate(result: AdoptValidationResult): string {
  const lines = [
    `Adopt validate — ready: ${result.ready}`,
    `  Blocking gaps: ${result.blockingCount}`,
    `  Total gaps:    ${result.gaps.length}`,
  ];
  const blocking = result.gaps.filter((g) => g.severity === "blocking");
  if (blocking.length > 0) {
    lines.push("", "Blocking:");
    for (const gap of blocking.slice(0, 15)) {
      lines.push(`  [${gap.id}] ${gap.message}`);
      if (gap.fix) lines.push(`           fix: ${gap.fix}`);
    }
    if (blocking.length > 15) {
      lines.push(`  …and ${blocking.length - 15} more (use --json)`);
    }
  }
  return lines.join("\n");
}

export function formatAdoptSetupMark(itemId: string, state: AdoptSetupState): string {
  const item = state.items[itemId];
  return `Marked adopt setup item "${itemId}" done at ${item?.at ?? "unknown"}.`;
}

export function formatAdoptContextRecord(id: string, answer: string): string {
  return `Recorded adopt context ${id} = ${answer}`;
}
