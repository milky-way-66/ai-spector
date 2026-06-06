import { Command } from "commander";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  findProjectRoot,
  loadDocflowConfig,
  resolveFromRoot,
  packageBundleRoot,
  loadDocumentsManifest,
  loadBasicDesignListManifest,
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
  const tg = graph.toTraceabilityGraph();
  return {
    documents: registry.documents.length,
    sections: totalSections,
    graphNodes: graph.nodesById.size,
    graphEdges: tg.edges.length,
    documentIds: tg.nodes.filter((n) => n.type === "document").map((n) => n.id),
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
// DAG generation from pack manifest
// ---------------------------------------------------------------------------

/**
 * Derive a `dag.srs.json` + `dag.srs.graph-seeds.json` pair from a pack manifest.
 * All documents become flat DAG nodes with no dependsOn (ordering is unknown for
 * arbitrary packs). The AI IDE is expected to refine the dependency graph during
 * generate workflows.
 */
function buildDagFromManifest(manifest: PackManifest): {
  dag: object;
  seeds: object;
} {
  const packSlug = manifest.packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const dagNodes: object[] = [];
  const seedsMap: Record<string, string> = {};

  for (const doc of manifest.documents) {
    if (doc.perDomain) continue; // skip per-domain breakout templates — not DAG nodes
    const docSlug = doc.documentId
      .replace(/^doc\.[^.]+\./, "") // strip nodePrefix (e.g. "doc.msrs.")
      .replace(/\./g, "-");
    const dagId = `${packSlug}.${docSlug}`;
    const output = doc.output ?? doc.outputPattern ?? `${docSlug}.md`;
    dagNodes.push({ id: dagId, template: doc.template, output, dependsOn: [] });
    seedsMap[dagId] = doc.documentId;
  }

  const dag = { version: 1, root: "docs/srs", nodes: dagNodes };
  const seeds = {
    version: 1,
    description: `Map dag.srs.json node ids to graph document ids for pack "${manifest.packName}"`,
    seeds: seedsMap,
    perDomain: manifest.perDomainTemplates
      ? Object.fromEntries(
          Object.entries(manifest.perDomainTemplates).map(([domain, templateDocId]) => [
            domain,
            { graphNodeType: domain, documentPattern: `${templateDocId}-{id}`, seedFromDomainId: true },
          ]),
        )
      : {},
  };

  return { dag, seeds };
}

async function writeDagFiles(root: string, dag: object, seeds: object): Promise<void> {
  const dagDir = join(root, ".ai-spector", ".docflow", "config");
  await mkdir(dagDir, { recursive: true });
  await writeJson(join(dagDir, "dag.srs.json"), dag);
  await writeJson(join(dagDir, "dag.srs.graph-seeds.json"), seeds);
}

async function restoreBuiltinDagFiles(root: string): Promise<void> {
  const { scaffoldBundleRoot } = await import("../config/load.js");
  const srcDir = join(scaffoldBundleRoot(), ".ai-spector", ".docflow", "config");
  const destDir = join(root, ".ai-spector", ".docflow", "config");
  await mkdir(destDir, { recursive: true });
  for (const name of ["dag.srs.json", "dag.srs.graph-seeds.json"]) {
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    if (existsSync(src)) {
      await copyFile(src, dest);
    }
  }
}

// ---------------------------------------------------------------------------
// template use <name>
// ---------------------------------------------------------------------------

async function runTemplateUse(name: string, opts: { cwd?: string }) {
  const { root, config, configFile } = await loadConfigAndRoot(opts.cwd);

  if (name === "builtin" || name === "default") {
    if (config.packs) {
      delete config.packs;
    }
    await saveConfig(configFile, config);
    console.log("Switched to builtin templates. Restoring builtin DAG config...");
    await restoreBuiltinDagFiles(root);
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
    config.packs = { active: name };
    await saveConfig(configFile, config);
    console.log(`Switched to pack "${name}". Rebuilding registry, graph, and DAG config...`);

    // Write pack-derived DAG files so generate workflows use valid graph ids
    const { dag, seeds } = buildDagFromManifest(manifest);
    await writeDagFiles(root, dag, seeds);
  }

  const stats = await rebuildRegistryAndGraph(root, config);
  console.log(
    `Done. ${stats.documents} documents, ${stats.sections} sections, ` +
      `${stats.graphNodes} graph nodes, ${stats.graphEdges} edges.`,
  );

  const activePack = config.packs?.active ?? "builtin";
  const docIdList = stats.documentIds?.map((id: string) => `   - ${id}`).join("\n") ??
    `   (run \`npx ai-spector template inspect ${activePack}\` to list them)`;
  console.log(`
Active graph document ids (valid query seeds):
${docIdList}

Note: .cursor/skills/ai-spector-generate-srs/references/runbook.md still references
builtin ids — update it or ask the agent to use the ids above when querying the graph.
`);
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

  // Write pack-derived DAG files so generate workflows use correct graph ids
  const { dag, seeds } = buildDagFromManifest(finalManifest);
  await writeDagFiles(root, dag, seeds);

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
// template export <output-path>
// ---------------------------------------------------------------------------

async function runTemplateExport(
  outputPath: string,
  opts: { cwd?: string; pack?: string; overwrite?: boolean },
) {
  const cwd = opts.cwd ?? process.cwd();
  const { root, config } = await loadConfigAndRoot(cwd);

  // Determine pack name to export
  let packName = opts.pack ?? config.packs?.active ?? "builtin";
  if (!packName || packName === "default") packName = "builtin";

  // Resolve output path
  const outputAbs = resolve(cwd, outputPath);

  // Check if output exists
  if (await pathExists(outputAbs)) {
    if (!opts.overwrite) {
      console.error("Output path already exists. Use --overwrite to replace it.");
      process.exitCode = 1;
      return;
    }
    await rm(outputAbs, { recursive: true, force: true });
  }

  // Create output dirs
  const outputTemplatesDir = join(outputAbs, "templates");
  await mkdir(outputTemplatesDir, { recursive: true });

  let manifest: PackManifest;
  let templateCount = 0;

  if (packName === "builtin") {
    // Load both builtin manifests
    const { bundleRoot, manifest: srsManifest } = await loadDocumentsManifest();
    const bdManifest = await loadBasicDesignListManifest();

    // Merge documents, copying templates while preserving subdirectory structure
    const allDocs: PackManifest["documents"] = [];

    for (const srcManifest of [srsManifest, bdManifest]) {
      const srcTemplatesDir = join(bundleRoot, srcManifest.templatesDir);
      for (const doc of srcManifest.documents) {
        // srcManifest.templatesDir is e.g. "templates/srs" — extract the subdir
        // relative to the root "templates/" folder
        const subdir = srcManifest.templatesDir.replace(/^templates\/?/, "");
        const relPath = subdir ? join(subdir, doc.template) : doc.template;
        const srcFile = join(srcTemplatesDir, doc.template);
        const destFile = join(outputTemplatesDir, relPath);
        // Ensure subdirectory exists
        await mkdir(join(outputTemplatesDir, subdir || "."), { recursive: true });
        if (await pathExists(srcFile)) {
          await copyFile(srcFile, destFile);
          templateCount++;
        }
        allDocs.push({ ...doc, template: relPath });
      }
    }

    manifest = {
      version: srsManifest.version,
      name: "builtin",
      packName: "builtin",
      templatesDir: "templates",
      nodePrefix: "doc.srs",
      perDomainTemplates: {
        useCase: "doc.srs.use-case-detail",
        feature: "doc.srs.system-feature-detail",
      },
      defaultListedIn: {
        useCase: "doc.srs.use-cases",
        feature: "doc.srs.system-features-list",
        actor: "doc.srs.use-cases",
      },
      documents: allDocs,
    };
  } else {
    // Custom pack
    const packDir = join(root, ".ai-spector", "packs", packName);
    const manifestPath = join(packDir, "manifest.json");
    if (!(await pathExists(manifestPath))) {
      console.error(`Pack "${packName}" not found. Expected manifest at: ${manifestPath}`);
      process.exitCode = 1;
      return;
    }

    manifest = await readJson<PackManifest>(manifestPath);
    const srcTemplatesDir = join(packDir, manifest.templatesDir ?? "templates");

    // Copy templates preserving structure
    if (await pathExists(srcTemplatesDir)) {
      await copyTree(srcTemplatesDir, outputTemplatesDir);
      // Count template files
      const countFiles = async (dir: string): Promise<number> => {
        let count = 0;
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              count += await countFiles(join(dir, entry.name));
            } else if (entry.name.endsWith(".md")) {
              count++;
            }
          }
        } catch { /* ignore */ }
        return count;
      };
      templateCount = await countFiles(srcTemplatesDir);
    }

    // Override templatesDir to "templates" in output
    manifest = { ...manifest, templatesDir: "templates" };

    // Copy skill-hints.md if present
    const skillHintsSrc = join(packDir, "skill-hints.md");
    if (await pathExists(skillHintsSrc)) {
      await copyFile(skillHintsSrc, join(outputAbs, "skill-hints.md"));
    }
  }

  // Write manifest.json
  await writeJson(join(outputAbs, "manifest.json"), manifest);

  // Print summary
  const relOutput = outputPath.startsWith("/") ? outputPath : `./${outputPath}`;
  console.log(`\n✓ Exported pack '${packName}' to ${relOutput}/\n`);
  console.log(`  Templates : ${templateCount} files`);
  console.log(`  Manifest  : ${join(outputPath, "manifest.json")}`);
  console.log();
  console.log("To use this template in another project:");
  console.log("  1. Copy the folder to the other project's workspace");
  console.log(`  2. Run: npx ai-spector template scan ./${outputPath}`);
  console.log('  3. Ask your AI: "set up template pack"');
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

  template
    .command("export <output-path>")
    .description(
      "Export the active (or specified) template pack as a portable folder for use in another project.",
    )
    .option("-C, --cwd <path>", "Project root", process.cwd())
    .option("--pack <name>", "Pack to export (default: active pack)")
    .option("--overwrite", "Replace output path if it already exists")
    .action(async (outputPath: string, opts) => {
      await runTemplateExport(outputPath, {
        cwd: resolve(opts.cwd ?? process.cwd()),
        pack: opts.pack as string | undefined,
        overwrite: Boolean(opts.overwrite),
      });
    });
}
