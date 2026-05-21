#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { writeJson, readJson } from "./util/fs.js";
import { resolveProjectPaths } from "./util/paths.js";
import { buildSectionRegistry } from "./registry/build.js";
import { bootstrapFromRegistry } from "./commands/bootstrap.js";
import { validateGraph, formatIssues } from "./commands/validate.js";
import { runInit } from "./commands/init.js";
import { runAnalyzePrep } from "./commands/analyze.js";
import { runGraphQuery } from "./commands/graph-query.js";
import { runGraphImpact } from "./commands/graph-impact.js";
import { runGraphMerge } from "./commands/graph-merge.js";
import { runGraphVisualize } from "./commands/graph-visualize.js";
import { runGraphifyUpdate } from "./commands/graphify-update.js";
import { runIndex } from "./commands/index.js";
import type { SectionRegistry } from "./types.js";

const program = new Command();

program
  .name("ai-spector")
  .description(
    "AI Spector — init project, analyze prep, traceability graph, templates, Cursor workflow",
  )
  .version("0.1.0")
  .option("-r, --root <path>", "Project root (auto-detect via .ai-spector/docflow.config.json)");

function projectRootOpt(cmd: Command): string | undefined {
  return (cmd.optsWithGlobals() as { root?: string }).root;
}

async function getPaths(cmd: Command) {
  return resolveProjectPaths(projectRootOpt(cmd));
}

program
  .command("init")
  .description("Scaffold .ai-spector, Cursor commands/skills, and docs layout")
  .option("-f, --force", "Overwrite existing scaffold files")
  .option("-C, --cwd <path>", "Target directory", process.cwd())
  .action(async (opts) => {
    await runInit({
      targetDir: resolve(opts.cwd ?? process.cwd()),
      force: opts.force,
    });
  });

program
  .command("index")
  .description(
    "Refresh graph, knowledge merge, Graphify storage, and doc indexes from current project files",
  )
  .option("--graph-only", "Only registry + bootstrap + merge + validate (no Graphify, no doc indexes)")
  .option("--docs-only", "Only rebuild .ai-spector/index/*.md and state hashes")
  .option("--skip-graphify", "Skip Graphify update (code graph / graphify-index)")
  .option("--skip-docs", "Skip .ai-spector/index document indexes")
  .option("--skip-merge", "Skip merging knowledge.json into graph")
  .option("--skip-validate", "Skip graph validate after refresh")
  .action(async (opts, cmd) => {
    await runIndex({
      root: projectRootOpt(cmd),
      graphOnly: opts.graphOnly,
      docsOnly: opts.docsOnly,
      skipGraphify: opts.skipGraphify,
      skipDocs: opts.skipDocs,
      skipMerge: opts.skipMerge,
      skipValidate: opts.skipValidate,
    });
  });

program
  .command("analyze")
  .description(
    "Prepare graph structure (registry + bootstrap). Normally invoked by /analyze, not the user.",
  )
  .option(
    "--merge",
    "After prep, merge knowledge.json or extract/patch.json into the graph if present",
  )
  .action(async (opts, cmd) => {
    await runAnalyzePrep(projectRootOpt(cmd), { merge: opts.merge });
  });

const graphify = program
  .command("graphify")
  .description("Graphify CLI wrappers (sets GRAPHIFY_OUT — do not use graphify update --graph)");

graphify
  .command("update [path]")
  .description(
    "Run graphify update on data-source with output under .ai-spector/.docflow/graph/graphify-out",
  )
  .option(
    "--keep-stale",
    "Do not delete docs/data-source/graphify-out if Graphify wrote it there by mistake",
  )
  .action(async (path: string | undefined, opts, cmd) => {
    await runGraphifyUpdate({
      root: projectRootOpt(cmd),
      sourcePath: path,
      removeStaleOutput: !opts.keepStale,
    });
  });

const graph = program.command("graph").description("Traceability graph operations");

graph
  .command("registry")
  .description("Build section-registry.json from bundled SRS templates")
  .action(async (_opts, cmd) => {
    const paths = await getPaths(cmd);
    const registry = await buildSectionRegistry(paths.root);
    await writeJson(paths.registry, registry);
    const total = registry.documents.reduce((n, d) => n + d.sections.length, 0);
    console.log(
      `Wrote ${paths.registry} (${registry.documents.length} documents, ${total} sections)`,
    );
  });

graph
  .command("bootstrap")
  .description("Create structure nodes/edges from section registry")
  .option("-i, --registry <path>", "Registry path")
  .option("-o, --output <path>", "Graph output path")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const registryPath = opts.registry ?? paths.registry;
    const graphPath = opts.output ?? paths.graph;
    const registry = await readJson<SectionRegistry>(registryPath);
    const graph = bootstrapFromRegistry(registry);
    await writeJson(graphPath, graph.toTraceabilityGraph());
    console.log(
      `Wrote ${graphPath} (${graph.nodesById.size} nodes, ${graph.toTraceabilityGraph().edges.length} edges)`,
    );
  });

graph
  .command("query <id>")
  .description("Find relevant subgraph and projection paths (for IDE / generate)")
  .option("-d, --direction <dir>", "out | in | both", "both")
  .option("--depth <n>", "Traversal depth", "2")
  .option(
    "-e, --edges <types>",
    "Comma-separated edge types (default: generate set)",
  )
  .option("--json", "JSON output for agents")
  .action(async (id: string, opts, cmd) => {
    const paths = await getPaths(cmd);
    await runGraphQuery({
      graphPath: paths.graph,
      seedId: id,
      direction: opts.direction as "out" | "in" | "both",
      depth: Number(opts.depth),
      edges: opts.edges,
      json: opts.json,
    });
  });

graph
  .command("impact [id]")
  .description(
    "Impact analysis: regenerate / review / downstream buckets (id optional with --file / --heading / --git)",
  )
  .option("--file <path>", "Resolve origin from repo-relative doc path")
  .option("--heading <text>", "Resolve section by heading (optionally scoped with --file)")
  .option("--git", "Resolve seeds from current git diff (staged + unstaged) and merge impact")
  .option("--change <type>", "Change type", "content_change")
  .option("-o, --output <path>", "Write impact report JSON")
  .option("--json", "Print JSON")
  .action(async (id: string | undefined, opts, cmd) => {
    const paths = await getPaths(cmd);
    if (!id && !opts.file && !opts.heading && !opts.git) {
      console.error(
        "Provide <nodeId>, --file <path>, --heading <text>, or --git to resolve the change origin.",
      );
      process.exitCode = 1;
      return;
    }
    await runGraphImpact({
      graphPath: paths.graph,
      rulesPath: paths.rulesImpact,
      projectRoot: paths.root,
      originId: id,
      file: opts.file,
      heading: opts.heading,
      git: opts.git,
      change: opts.change,
      output: opts.output,
      json: opts.json,
    });
  });

graph
  .command("merge [file]")
  .description(
    "Merge domain patch or knowledge.json into traceability graph (upsert nodes/edges)",
  )
  .option("--from-knowledge", "Read .ai-spector/.docflow/analysis/knowledge.json")
  .option("-g, --graph <path>", "Graph path")
  .option("-o, --write-patch <path>", "Write normalized extract patch before merge")
  .option("--no-validate", "Skip validate after merge")
  .option("--dry-run", "Compute merge stats without saving")
  .action(async (file: string | undefined, opts, cmd) => {
    const paths = await getPaths(cmd);
    await runGraphMerge({
      root: paths.root,
      inputPath: file,
      fromKnowledge: opts.fromKnowledge,
      graphPath: opts.graph ?? paths.graph,
      writePatch: opts.writePatch,
      validate: !opts.noValidate,
      dryRun: opts.dryRun,
    });
  });

graph
  .command("visualize")
  .description("Generate HTML report to explore graph and knowledge in a browser")
  .option("-o, --output <path>", "Output HTML path")
  .option("-g, --graph <path>", "Graph JSON path")
  .option("--knowledge <path>", "knowledge.json path")
  .option("--no-knowledge", "Omit knowledge.json from report")
  .option("--open", "Open the HTML file in the default browser")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    await runGraphVisualize({
      root: paths.root,
      graphPath: opts.graph ?? paths.graph,
      knowledgePath: opts.knowledge,
      output: opts.output,
      open: opts.open,
      skipKnowledge: opts.noKnowledge,
    });
  });

graph
  .command("validate")
  .description("Validate graph against bundled schema and traceability rules")
  .option("-g, --graph <path>", "Graph path")
  .option("-s, --schema <path>", "Schema path")
  .option("--registry <path>", "Registry for REGISTRY-COMPLETE")
  .option("--rules <path>", "Rules manifest path")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const issues = await validateGraph({
      graphPath: opts.graph ?? paths.graph,
      schemaPath: opts.schema ?? paths.schema,
      registryPath: opts.registry ?? paths.registry,
      rulesPath: opts.rules ?? paths.rulesTraceability,
    });
    console.log(formatIssues(issues));
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  console.error("");
  console.error("Fix the issue above, then re-run the same command.");
  console.error("In Cursor, re-run the slash command (/analyze, /validate-graph, …) — see .cursor/commands/_cli-failures.md");
  process.exit(1);
});
