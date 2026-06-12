import type { CheckResult, CheckFinding } from "@/core/operations/check.js";

function formatFinding(f: CheckFinding): string {
  const icon = f.fixed ? "✓ fixed" : f.severity === "error" ? "✗ error" : "! warn";
  const lines: string[] = [`  [${icon}] ${f.ruleId}: ${f.message}`];
  if (f.path) lines.push(`           path: ${f.path}`);
  if (f.fix && !f.fixed) lines.push(`           fix:  ${f.fix}`);
  return lines.join("\n");
}

export function formatCheck(result: CheckResult): string {
  const lines: string[] = [];
  const errors = result.findings.filter((f) => f.severity === "error" && !f.fixed);
  const warnings = result.findings.filter((f) => f.severity === "warning" && !f.fixed);
  const fixed = result.findings.filter((f) => f.fixed);

  if (result.findings.length === 0) {
    return `Workspace check passed — no structural issues found.`;
  }

  lines.push(`Workspace check — ${result.projectRoot}`);
  for (const f of result.findings) lines.push(formatFinding(f));
  lines.push("");
  lines.push(
    `${result.ok ? "OK" : "FAILED"} — ${errors.length} error(s), ${warnings.length} warning(s)` +
      (fixed.length ? `, ${fixed.length} auto-fixed` : ""),
  );
  if (!result.ok) {
    lines.push(`Fix the error(s) above (or run \`ai-spector check --fix\`) before continuing.`);
  }
  return lines.join("\n");
}
