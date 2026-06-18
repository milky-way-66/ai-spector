import type { UpgradeScanResult, UpgradeSetupState } from "@/core/upgrade/types.js";

export function formatUpgradeScan(result: UpgradeScanResult): string {
  const lines = [
    `Upgrade scan — ${result.scannedAt}`,
    `  From:  ${result.fromVersion}`,
    `  To:    ${result.toVersion}`,
    `  Editors: ${result.editors.join(", ") || "none"}`,
    `  Applicable items: ${result.applicableItems.length}`,
    `  Auto-fixable:     ${result.autoFixable.length}`,
    `  Ready:            ${result.ready}`,
  ];
  if (result.findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of result.findings) {
      const icon =
        finding.status === "ok" ? "✓" : finding.status === "warning" ? "!" : "✗";
      lines.push(
        `  ${icon} [${finding.id}] ${finding.message}${finding.fix ? ` (${finding.fix})` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

export function formatUpgradeApply(result: {
  applied: string[];
  failed: Array<{ id: string; error: string }>;
}): string {
  const lines = [`Upgrade apply — applied ${result.applied.length} item(s).`];
  if (result.applied.length > 0) {
    lines.push(`  Applied: ${result.applied.join(", ")}`);
  }
  if (result.failed.length > 0) {
    lines.push("", "Failed:");
    for (const f of result.failed) {
      lines.push(`  [${f.id}] ${f.error}`);
    }
  }
  return lines.join("\n");
}

export function formatUpgradeValidate(result: {
  ready: boolean;
  scan: UpgradeScanResult;
}): string {
  return [
    `Upgrade validate — ready: ${result.ready}`,
    `  From: ${result.scan.fromVersion} → To: ${result.scan.toVersion}`,
    `  Open required findings: ${
      result.scan.findings.filter((f) => f.severity === "required" && f.status !== "ok").length
    }`,
  ].join("\n");
}

export function formatUpgradeStatus(state: UpgradeSetupState, scaffoldVersion: string, packageVersion: string): string {
  const lines = [
    "Upgrade status",
    `  Scaffold version: ${scaffoldVersion}`,
    `  Package version:  ${packageVersion}`,
    `  Session: ${state.startedAt ?? "not started"} → ${state.completedAt ?? "in progress"}`,
  ];
  const done = Object.entries(state.items).filter(([, v]) => v.done);
  if (done.length > 0) {
    lines.push("", "Completed items:");
    for (const [id, item] of done) {
      lines.push(`  ✓ ${id} (${item.at})`);
    }
  }
  return lines.join("\n");
}

export function formatUpgradeSetupMark(itemId: string, state: UpgradeSetupState): string {
  const item = state.items[itemId];
  return `Marked upgrade setup item "${itemId}" done at ${item?.at ?? "unknown"}.`;
}
