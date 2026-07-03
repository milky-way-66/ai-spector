import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import semver from "semver";
import { pathExists, writeJson } from "../util/fs.js";
import { filterApplicableItems, loadUpgradeChecklist } from "./checklist.js";
import { evaluateItemDetect } from "./detect.js";
import {
  scanConfigDrift,
  scanConfigSchema,
  scanHook,
  scanMcpConfig,
  scanScaffoldPresence,
  scanScaffoldVersion,
} from "./detectors.js";
import { detectEditors } from "./editors.js";
import { installedPackageVersion } from "./package-version.js";
import { upgradeArtifactPaths } from "./paths.js";
import { readScaffoldVersion } from "./stamp.js";
import type { UpgradeFinding, UpgradeScanResult } from "./types.js";

function mergeFindings(findings: UpgradeFinding[]): UpgradeFinding[] {
  const byId = new Map<string, UpgradeFinding>();
  for (const finding of findings) {
    byId.set(finding.id, finding);
  }
  return [...byId.values()];
}

function computeReady(findings: UpgradeFinding[]): boolean {
  return !findings.some(
    (f) =>
      f.severity === "required" &&
      (f.status === "missing" || f.status === "stale" || f.status === "warning"),
  );
}

export async function runUpgradeScan(opts: {
  root: string;
  toVersion?: string;
}): Promise<UpgradeScanResult> {
  const root = resolve(opts.root);
  // Accept any of: engine.json (new), docops.config.json, or legacy docflow.config.json
  const markerPaths = [
    join(root, ".ai-spector", "engine.json"),
    join(root, ".docops", "docops.config.json"),
    join(root, ".ai-spector", "docflow.config.json"),
  ];
  const initialized = await Promise.all(markerPaths.map((m) => pathExists(m)));
  if (!initialized.some(Boolean)) {
    throw new Error(
      `Project not initialized. Run: npx ai-spector init`,
    );
  }

  const fromVersion = await readScaffoldVersion(root);
  const toVersion = opts.toVersion ?? installedPackageVersion();

  if (semver.lt(toVersion, fromVersion)) {
    throw new Error(`Downgrade unsupported (${fromVersion} → ${toVersion})`);
  }

  if (semver.eq(toVersion, fromVersion)) {
    const result: UpgradeScanResult = {
      scannedAt: new Date().toISOString(),
      fromVersion,
      toVersion,
      editors: [],
      applicableItems: [],
      autoFixable: [],
      findings: [],
      ready: true,
      alreadyCurrent: true,
    };
    const { dir, scanResult } = upgradeArtifactPaths(root);
    await mkdir(dir, { recursive: true });
    await writeJson(scanResult, result);
    return result;
  }

  const editors = await detectEditors(root);
  const effectiveEditors: ("cursor" | "claude")[] =
    editors.length > 0 ? editors : ["cursor", "claude"];

  const checklist = loadUpgradeChecklist();
  const applicable = filterApplicableItems(checklist.items, {
    fromVersion,
    toVersion,
    editors: effectiveEditors,
  });

  const ctx = { root, fromVersion, toVersion, editors: effectiveEditors };
  const itemFindings: UpgradeFinding[] = [];
  for (const item of applicable) {
    const finding = await evaluateItemDetect(item, ctx);
    if (finding) {
      itemFindings.push(finding);
    }
  }

  const builtinFindings = mergeFindings([
    ...(scanScaffoldVersion(fromVersion, toVersion) ? [scanScaffoldVersion(fromVersion, toVersion)!] : []),
    ...(await scanConfigSchema(root)),
    ...(await scanConfigDrift(root)),
    ...(await scanScaffoldPresence(root, effectiveEditors)),
    ...(await scanHook(root)),
    ...(await scanMcpConfig(root, effectiveEditors)),
  ]);

  const findings = mergeFindings([...itemFindings, ...builtinFindings]);
  const applicableItems = applicable.map((i) => i.id);
  const autoFixable = applicable
    .filter((i) => i.kind === "auto" || i.kind === "config")
    .map((i) => i.id);

  const result: UpgradeScanResult = {
    scannedAt: new Date().toISOString(),
    fromVersion,
    toVersion,
    editors: effectiveEditors,
    applicableItems,
    autoFixable,
    findings,
    ready: computeReady(findings),
  };

  const { dir, scanResult } = upgradeArtifactPaths(root);
  await mkdir(dir, { recursive: true });
  await writeJson(scanResult, result);

  return result;
}
