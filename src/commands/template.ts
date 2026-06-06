import { Command } from "commander";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  findProjectRoot,
  loadDocflowConfig,
  resolveFromRoot,
} from "../config/load.js";
import { readJson, writeJson, pathExists } from "../util/fs.js";
import { buildSectionRegistry } from "../registry/build.js";
import { bootstrapFromRegistry } from "./bootstrap.js";
import type { DocflowConfig, PackManifest, DocumentsManifest } from "../config/types.js";

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
// Command group registration
// ---------------------------------------------------------------------------

export function registerTemplateCommand(program: Command) {
  const template = program
    .command("template")
    .description("Template pack management: list, use, inspect");

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
}
