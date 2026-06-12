import { assessReadiness, type ReadinessAssessOptions } from "../readiness/assess.js";
import { resolveReadinessConfigStatus } from "../readiness/config.js";
import {
  buildReadinessOutputChecklist,
  type BuildOutputChecklistOptions,
} from "../readiness/output-checklist.js";
import { scanDocumentsForReadiness, type ReadinessScanOptions } from "../readiness/scan-docs.js";
import { loadMergedReadinessCriteria } from "../readiness/resolve.js";
import { listReadinessProfiles } from "../readiness/profiles.js";

export type { ReadinessAssessOptions } from "../readiness/assess.js";
export type { ReadinessAssessResult } from "../readiness/types.js";
export type { ReadinessCriterionResult, ReadinessAssessSummary } from "../readiness/types.js";
export type { ProfileSummary } from "../readiness/profiles.js";
export type { ResolvedReadinessCriteria } from "../readiness/resolve.js";
export type { ReadinessConfigStatus } from "../readiness/config.js";
export type { ReadinessScanResult, ReadinessScanOptions } from "../readiness/scan-docs.js";
export type {
  ReadinessOutputChecklistResult,
  OutputChecklistForPath,
  OutputChecklistItem,
} from "../readiness/output-checklist.js";

export async function runReadinessConfig(opts: { root?: string }) {
  return resolveReadinessConfigStatus(opts);
}

export async function runReadinessScan(opts: ReadinessScanOptions) {
  return scanDocumentsForReadiness(opts);
}

export async function runReadinessAssess(opts: ReadinessAssessOptions) {
  return assessReadiness(opts);
}

export async function runReadinessProfilesList() {
  return listReadinessProfiles();
}

export async function runReadinessGetCriteria(opts: {
  root?: string;
  docType?: string;
  profile?: string;
}) {
  return loadMergedReadinessCriteria(opts);
}

/** Lookup rubric for agent-driven output compliance (no automated semantic scoring). */
export async function runReadinessOutputChecklist(opts: BuildOutputChecklistOptions) {
  return buildReadinessOutputChecklist(opts);
}

export function registerReadinessCommand(program: import("commander").Command): void {
  const readiness = program
    .command("readiness")
    .description("Context readiness assessment (prefer MCP readiness_assess)");

  readiness
    .command("assess")
    .description("Score readiness criteria against graph + context store")
    .option("--doc-type <type>", "Document type (srs, arc42, custom pack name)")
    .option("--profile <id>", "Tailoring profile: general, regulated, arc42")
    .option("--targets <nodes>", "Comma-separated DAG nodes in scope")
    .option("--all-targets", "Assess all targets in criteria file")
    .option("--json", "JSON output")
    .action(async (opts: { docType?: string; profile?: string; targets?: string; allTargets?: boolean; json?: boolean }) => {
      const targets = opts.targets?.split(",").map((s) => s.trim()).filter(Boolean);
      const result = await runReadinessAssess({
        docType: opts.docType,
        profile: opts.profile,
        targets,
        targetAll: opts.allTargets ?? !targets?.length,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = result.ready ? 0 : 1;
        return;
      }
      console.log(`Readiness — ${result.docType} (profile: ${result.profile})`);
      console.log(`Criteria: ${result.criteriaPath}`);
      console.log(
        `Summary: ${result.summary.blockingMet}/${result.summary.blockingTotal} blocking met | ` +
          `${result.summary.blockingMissing} blocking gaps | ready: ${result.ready}`,
      );
      if (result.blockingGaps.length > 0) {
        console.log("\nBlocking gaps:");
        for (const g of result.blockingGaps) {
          console.log(`  [${g.id}] ${g.status}: ${g.question}`);
          if (g.gap) console.log(`         ${g.gap}`);
        }
      }
      if (result.questionsForUser.length > 0) {
        console.log("\nQuestions for user:");
        result.questionsForUser.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
      }
      process.exitCode = result.ready ? 0 : 1;
    });

  readiness
    .command("profiles")
    .description("List tailoring profiles")
    .option("--json", "JSON output")
    .action(async (opts: { json?: boolean }) => {
      const profiles = await runReadinessProfilesList();
      if (opts.json) {
        console.log(JSON.stringify({ profiles }, null, 2));
        return;
      }
      for (const p of profiles) {
        console.log(`  ${p.id} — ${p.title}`);
        if (p.description) console.log(`    ${p.description}`);
      }
    });

  readiness
    .command("config")
    .description("Show active readiness configuration and profile drift")
    .option("--json", "JSON output")
    .action(async (opts: { json?: boolean }) => {
      const result = await runReadinessConfig({});
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`Config: ${result.configPath} (configured: ${result.configured})`);
      for (const dt of result.docTypes) {
        console.log(
          `  ${dt.docType}: profile=${dt.profile} (${dt.profileSource})` +
            `${dt.enabled ? "" : " [disabled]"}`,
        );
      }
      if (result.profileDrift.detected) {
        console.log(`\n⚠ Profile drift: ${result.profileDrift.message}`);
      }
      for (const s of result.suggestions) {
        console.log(`  → ${s}`);
      }
    });

  readiness
    .command("scan")
    .description("Scan existing documents against active profile and completeness rules")
    .option("--doc-type <type>", "Document type (default: srs)")
    .option("--profile <id>", "Override profile for this scan")
    .option("--paths <paths>", "Comma-separated doc paths to scan")
    .option("--update-scan", "Record scan in docflow.config.json readiness.lastScan")
    .option("--json", "JSON output")
    .action(
      async (opts: {
        docType?: string;
        profile?: string;
        paths?: string;
        updateScan?: boolean;
        json?: boolean;
      }) => {
        const paths = opts.paths?.split(",").map((s) => s.trim()).filter(Boolean);
        const result = await runReadinessScan({
          docType: opts.docType,
          profile: opts.profile,
          paths,
          updateLastScan: opts.updateScan,
        });
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          process.exitCode = result.ok ? 0 : 1;
          return;
        }
        console.log(
          `Scan — ${result.docType} profile=${result.profile} (${result.documentsScanned} docs)`,
        );
        console.log(
          `Findings: ${result.errorCount} errors, ${result.warningCount} warnings, ${result.suggestionCount} suggestions`,
        );
        for (const f of result.findings.slice(0, 20)) {
          console.log(`  [${f.severity}] ${f.path}: ${f.message}`);
          console.log(`           → ${f.suggestion}`);
        }
        if (result.findings.length > 20) {
          console.log(`  …and ${result.findings.length - 20} more (use --json)`);
        }
        process.exitCode = result.ok ? 0 : 1;
      },
    );

  readiness
    .command("criteria")
    .description("Show merged readiness criteria (base + profile)")
    .option("--doc-type <type>", "Document type")
    .option("--profile <id>", "Tailoring profile")
    .option("--json", "JSON output (default)")
    .action(async (opts: { docType?: string; profile?: string; json?: boolean }) => {
      const merged = await runReadinessGetCriteria({
        docType: opts.docType,
        profile: opts.profile,
      });
      const out = {
        docType: merged.docType,
        profile: merged.profileId,
        appliedProfiles: merged.appliedProfiles,
        criteriaPath: merged.criteriaPath,
        globalCount: merged.criteria.globalCriteria.length,
        targetCount: merged.criteria.targets.length,
        criteria: merged.criteria,
      };
      console.log(JSON.stringify(out, null, 2));
    });
}
