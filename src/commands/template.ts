import { Command } from "commander";
import { existsSync } from "node:fs";
import { copyFile, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  findProjectRoot,
  loadDocflowConfig,
  resolveFromRoot,
} from "../config/load.js";
import { readJson, writeJson, pathExists, copyTree } from "../util/fs.js";
import { buildSectionRegistry } from "../registry/build.js";
import { bootstrapFromRegistry } from "./bootstrap.js";
import type { DocflowConfig, PackManifest, DocumentsManifest } from "../config/types.js";
import { scanTemplateFolder } from "../template/scan.js";
import { validatePackManifest } from "../template/validate.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadConfigAndRoot(cwd?: string) {
  const root = cwd ?? findProjectRoot();
  const { config, configFile } = await loadDocflowConfig(root);
  return { root, config, configFile };
}

async function saveConfig(configFile: string, config: DocflowConfig) {
  await writeJson(configFile, config);
}

async function rebuildRegistryAndGraph(root: string, config: DocflowConfig) {
  const p = config.paths;
  const registryPath = resolveFromRoot(root, p.registry);
  const graphPath = resolveFromRoot(root, p.graph);

  const registry = await buildSectionRegistry(root);
  await writeJson(registryPath, registry);

  const graph = bootstrapFromRegistry(registry);
  await writeJson(graphPath, graph.toTraceabilityGraph());

  const totalSections = registry.documents.reduce((n, d) => n + d.sections.length, 0);
  return {
    documents: registry.documents.length,
    sections: totalSections,
    graphNodes: graph.nodesById.size,
    graphEdges: graph.toTraceabilityGraph().edges.length,
  };
}

async function listInstalledPackNames(root: string): Promise<string[]> {
  const packsDir = join(root, ".ai-spector", "packs");
  if (!(await pathExists(packsDir))) return [];
  try {
    const entries = await readdir(packsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name !== ".staging")
      .map((e) => e.name);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// template list
// ---------------------------------------------------------------------------

async function runTemplateList(opts: { cwd?: string }) {
  const { root, config } = await loadConfigAndRoot(opts.cwd);
  const active = config.packs?.active;
  const installed = await listInstalledPackNames(root);

  console.log("Template packs:");

  // builtin entry
  const builtinActive = !active || active === "builtin";
  const builtinMarker = builtinActive ? "●" : "○";
  const builtinStatus = builtinActive ? "(active)" : "(default — used when no custom pack is active)";
  console.log(`  ${builtinMarker} builtin        ${builtinStatus}`);

  // installed custom packs
  for (const name of installed) {
    const isActive = active === name;
    const marker = isActive ? "●" : "○";
    const status = isActive ? "(active)" : "(inactive)";

    let description = "";
    try {
      const manifestPath = join(root, ".ai-spector", "packs", name, "manifest.json");
      const manifest = await readJson<PackManifest>(manifestPath);
      description = manifest.description ? `  ${manifest.description}` : "";
    } catch {
      // ignore
    }

    console.log(`  ${marker} ${name.padEnd(16)}${status}${description}`);
  }
}

// ---------------------------------------------------------------------------
// template use <name>
// ---------------------------------------------------------------------------

async function runTemplateUse(name: string, opts: { cwd?: string }) {
  const { root, config, configFile } = await loadConfigAndRoot(opts.cwd);

  if (name === "builtin" || name === "default") {
    // Remove packs.active
    if (config.packs) {
      delete config.packs;
    }
    await saveConfig(configFile, config);
    console.log("Switched to builtin templates. Rebuilding registry and graph...");
  } else {
    // Verify pack exists
    const manifestPath = join(root, ".ai-spector", "packs", name, "manifest.json");
    if (!existsSync(manifestPath)) {
      console.error(
        `Pack "${name}" not found. Expected manifest at: ${manifestPath}`,
      );
      process.exitCode = 1;
      return;
    }
    config.packs = { active: name };
    await saveConfig(configFile, config);
    console.log(`Switched to pack "${name}". Rebuilding registry and graph...`);
  }

  const stats = await rebuildRegistryAndGraph(root, config);
  console.log(
    `Done. ${stats.documents} documents, ${stats.sections} sections, ` +
      `${stats.graphNodes} graph nodes, ${stats.graphEdges} edges.`,
  );
}

// ---------------------------------------------------------------------------
// template inspect <name>
// ---------------------------------------------------------------------------

async function runTemplateInspect(name: string, opts: { cwd?: string }) {
  const { root } = await loadConfigAndRoot(opts.cwd);

  let manifests: DocumentsManifest[];

  if (name === "builtin") {
    const { loadDocumentsManifest, loadBasicDesignListManifest } = await import(
      "../config/load.js"
    );
    const { manifest: srs } = await loadDocumentsManifest();
    const bd = await loadBasicDesignListManifest();
    manifests = [srs, bd];
  } else {
    const manifestPath = join(root, ".ai-spector", "packs", name, "manifest.json");
    if (!existsSync(manifestPath)) {
      console.error(
        `Pack "${name}" not found. Expected manifest at: ${manifestPath}`,
      );
      process.exitCode = 1;
      return;
    }
    const manifest = await readJson<PackManifest>(manifestPath);
    manifests = [manifest];
  }

  // Print table header
  const header =
    "documentId".padEnd(40) +
    "template".padEnd(40) +
    "output / outputPattern".padEnd(50) +
    "perDomain";
  const separator = "-".repeat(header.length);
  console.log(header);
  console.log(separator);

  for (const manifest of manifests) {
    for (const doc of manifest.documents) {
      const col1 = doc.documentId.padEnd(40);
      const col2 = doc.template.padEnd(40);
      const outputVal = doc.outputPattern ?? doc.output ?? "";
      const col3 = outputVal.padEnd(50);
      const col4 = doc.perDomain ?? "";
      console.log(`${col1}${col2}${col3}${col4}`);
    }
  }
}

// ---------------------------------------------------------------------------
// template scan <path>
// ---------------------------------------------------------------------------

async function runTemplateScan(sourcePath: string, opts: { cwd?: string }) {
  const resolvedSource = resolve(opts.cwd ?? process.cwd(), sourcePath);

  // Validate source is a directory
  if (!existsSync(resolvedSource)) {
    console.error(`Error: path does not exist: ${resolvedSource}`);
    process.exitCode = 1;
    return;
  }
  const { statSync } = await import("node:fs");
  if (!statSync(resolvedSource).isDirectory()) {
    console.error(`Error: path is not a directory: ${resolvedSource}`);
    process.exitCode = 1;
    return;
  }

  const { root } = await loadConfigAndRoot(opts.cwd);
  const stagingDir = join(root, ".ai-spector", "packs", ".staging");

  // Clear staging
  if (await pathExists(stagingDir)) {
    await rm(stagingDir, { recursive: true, force: true });
  }
  const { mkdir } = await import("node:fs/promises");
  await mkdir(stagingDir, { recursive: true });

  // Scan
  const result = await scanTemplateFolder(resolvedSource, stagingDir);

  // Write scan-result.json
  const scanResultPath = join(stagingDir, "scan-result.json");
  await writeJson(scanResultPath, result);

  // Print summary
  console.log(`\nScanned ${resolvedSource}:`);
  console.log(`  ${result.files.length} template file${result.files.length === 1 ? "" : "s"} found`);
  console.log();

  if (result.files.length > 0) {
    const fileCol = 32;
    const headCol = 10;
    const header =
      "File".padEnd(fileCol) + "Headings".padEnd(headCol) + "Placeholders";
    const divider = "─".repeat(header.length + 10);
    console.log(`  ${header}`);
    console.log(`  ${divider}`);
    for (const f of result.files) {
      const name = f.relativePath.padEnd(fileCol);
      const headings = String(f.headings.length).padEnd(headCol);
      const placeholders = f.placeholders.join(", ") || "(none)";
      console.log(`  ${name}${headings}${placeholders}`);
    }
    console.log();
  }

  const relStaging = join(".ai-spector", "packs", ".staging", "scan-result.json");
  console.log(`Scan saved → ${relStaging}`);
  console.log();
  console.log(`Next step: open your AI IDE and ask:`);
  console.log(`  "set up template pack"`);
  console.log(`The AI will read the scan result, ask you questions, refine`);
  console.log(`the templates, and write them to staging for you to review.`);
}

// ---------------------------------------------------------------------------
// template install [--name <name>] [--dry-run]
// ---------------------------------------------------------------------------

async function runTemplateInstall(opts: {
  cwd?: string;
  name?: string;
  dryRun?: boolean;
}) {
  const { root, config, configFile } = await loadConfigAndRoot(opts.cwd);
  const stagingDir = join(root, ".ai-spector", "packs", ".staging");

  // Check scan-result.json exists
  const scanResultPath = join(stagingDir, "scan-result.json");
  if (!(await pathExists(scanResultPath))) {
    console.error(
      'Error: scan-result.json not found in staging. Run `template scan` first.',
    );
    process.exitCode = 1;
    return;
  }

  // Check staleness (> 24h)
  const scanResult = await readJson<{ scannedAt: string }>(scanResultPath);
  const scannedAt = new Date(scanResult.scannedAt);
  const ageMs = Date.now() - scannedAt.getTime();
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  if (ageMs > 24 * 60 * 60 * 1000) {
    console.warn(
      `Warning: scan is ${ageHours} hours old — the AI may have worked with stale context.`,
    );
  }

  // Check manifest.json exists
  const stagingManifestPath = join(stagingDir, "manifest.json");
  if (!(await pathExists(stagingManifestPath))) {
    console.error(
      'Error: manifest.json not found in staging. Ask the AI to complete the setup workflow.',
    );
    process.exitCode = 1;
    return;
  }

  // Load + validate manifest
  const rawManifest = await readJson<unknown>(stagingManifestPath);
  const { valid, errors } = validatePackManifest(rawManifest);
  if (!valid) {
    console.error("manifest.json validation failed:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exitCode = 1;
    return;
  }

  const manifest = rawManifest as PackManifest;

  // Determine pack name
  const packName = opts.name ?? manifest.packName;

  // Check all template files exist in staging/templates/
  const stagingTemplatesDir = join(stagingDir, manifest.templatesDir ?? "templates");
  const missing: string[] = [];
  for (const doc of manifest.documents) {
    const tplPath = join(stagingTemplatesDir, doc.template);
    if (!(await pathExists(tplPath))) {
      missing.push(doc.template);
    }
  }
  if (missing.length > 0) {
    console.error("Error: the following template files are missing from staging:");
    for (const f of missing) {
      console.error(`  - ${f}`);
    }
    process.exitCode = 1;
    return;
  }

  // Dry run — stop here
  if (opts.dryRun) {
    console.log(`Dry run complete — all checks passed. Pack: ${packName}`);
    return;
  }

  // Destination
  const destDir = join(root, ".ai-spector", "packs", packName);

  // Remove existing if present
  if (await pathExists(destDir)) {
    await rm(destDir, { recursive: true, force: true });
  }

  // Copy templates
  const destTemplatesDir = join(destDir, "templates");
  await copyTree(stagingTemplatesDir, destTemplatesDir);

  // Write manifest to destination (with resolved packName)
  const finalManifest = { ...manifest, packName };
  await writeJson(join(destDir, "manifest.json"), finalManifest);

  // Patch config FIRST
  const previousPacks = config.packs;
  config.packs = { active: packName };
  await saveConfig(configFile, config);

  // Build registry + graph, roll back on failure
  let stats: Awaited<ReturnType<typeof rebuildRegistryAndGraph>>;
  try {
    stats = await rebuildRegistryAndGraph(root, config);
  } catch (err) {
    // Roll back config
    if (previousPacks === undefined) {
      delete config.packs;
    } else {
      config.packs = previousPacks;
    }
    await saveConfig(configFile, config);
    throw err;
  }

  // skill-hints.md — if the AI wrote one in staging, append to generate skill
  const skillHintsPath = join(stagingDir, "skill-hints.md");
  if (await pathExists(skillHintsPath)) {
    const hints = await readFile(skillHintsPath, "utf8");
    const cursorSkillPath = join(root, ".cursor/skills/ai-spector-generate/SKILL.md");
    if (await pathExists(cursorSkillPath)) {
      const existing = await readFile(cursorSkillPath, "utf8");
      await writeFile(
        cursorSkillPath,
        existing + "\n\n---\n\n## Pack hints: " + packName + "\n\n" + hints,
      );
      console.log("  Updated .cursor/skills/ai-spector-generate/SKILL.md with pack hints.");
    }
    await copyFile(skillHintsPath, join(destDir, "skill-hints.md"));
  }

  // Clear staging
  await rm(stagingDir, { recursive: true, force: true });

  // Print summary
  console.log(`\n✓ Pack '${packName}' installed and activated.\n`);
  console.log(`  Documents : ${stats.documents}`);
  console.log(`  Sections  : ${stats.sections}`);
  console.log(`  Graph     : ${stats.graphNodes} nodes, ${stats.graphEdges} edges`);
  console.log();
  console.log(`  Templates → .ai-spector/packs/${packName}/templates/`);
  console.log(`  Active    → docflow.config.json updated`);
  console.log();
  console.log(`Next: ask your AI to "generate <document>" to use the new template.`);
}

// ---------------------------------------------------------------------------
// template remove <name>
// ---------------------------------------------------------------------------

async function runTemplateRemove(name: string, opts: { cwd?: string }) {
  const { root, config } = await loadConfigAndRoot(opts.cwd);

  const packDir = join(root, ".ai-spector", "packs", name);
  if (!(await pathExists(packDir))) {
    console.error(`Error: pack "${name}" is not installed.`);
    process.exitCode = 1;
    return;
  }

  if (config.packs?.active === name) {
    console.error(
      `Error: pack '${name}' is currently active. Run \`template use builtin\` first.`,
    );
    process.exitCode = 1;
    return;
  }

  await rm(packDir, { recursive: true, force: true });
  console.log(`Removed pack '${name}'.`);
}

// ---------------------------------------------------------------------------
// Command group registration
// ---------------------------------------------------------------------------

export function registerTemplateCommand(program: Command) {
  const template = program
    .command("template")
    .description("Template pack management: list, use, inspect, scan, install, remove");

  template
    .command("list")
    .description("List installed template packs and show which is active")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .action(async (opts) => {
      await runTemplateList({ cwd: resolve(opts.cwd ?? process.cwd()) });
    });

  template
    .command("use <name>")
    .description(
      'Switch to a template pack (use "builtin" to revert to default). Re-indexes graph automatically.',
    )
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .action(async (name: string, opts) => {
      await runTemplateUse(name, { cwd: resolve(opts.cwd ?? process.cwd()) });
    });

  template
    .command("inspect <name>")
    .description(
      'Inspect a pack manifest as a table (use "builtin" to inspect the builtin templates).',
    )
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .action(async (name: string, opts) => {
      await runTemplateInspect(name, { cwd: resolve(opts.cwd ?? process.cwd()) });
    });

  template
    .command("scan <path>")
    .description(
      "Walk a folder of .md template files, extract headings + placeholders, write scan-result.json to staging.",
    )
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .action(async (sourcePath: string, opts) => {
      await runTemplateScan(sourcePath, { cwd: resolve(opts.cwd ?? process.cwd()) });
    });

  template
    .command("install")
    .description(
      "Install a template pack from staging (manifest.json + templates/ written by AI).",
    )
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--name <name>", "Override pack name from manifest")
    .option("--dry-run", "Validate and print without writing anything")
    .action(async (opts) => {
      await runTemplateInstall({
        cwd: resolve(opts.cwd ?? process.cwd()),
        name: opts.name as string | undefined,
        dryRun: Boolean(opts.dryRun),
      });
    });

  template
    .command("remove <name>")
    .description("Remove an installed template pack by name.")
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .action(async (name: string, opts) => {
      await runTemplateRemove(name, { cwd: resolve(opts.cwd ?? process.cwd()) });
    });
}
