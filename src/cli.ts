#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { writeJson, readJson } from "./util/fs.js";
import { resolveProjectPaths } from "./util/paths.js";
import { buildSectionRegistry } from "./registry/build.js";
import { bootstrapFromRegistry } from "./commands/bootstrap.js";
import { validateGraph, formatIssues } from "./commands/validate.js";
import { runInit } from "./commands/init.js";
import { runSyncCursor } from "./commands/sync-cursor.js";
import { runAnalyzePrep } from "./commands/analyze.js";
import { runGraphQuery } from "./commands/graph-query.js";
import { runGraphImpact } from "./commands/graph-impact.js";
import { runGraphMerge } from "./commands/graph-merge.js";
import { runGraphReport } from "./commands/graph-report.js";
import { ensureHubBundles } from "./graph/bundles.js";
import { loadInMemoryGraph } from "./graph/loadGraph.js";
import { runGraphVisualize } from "./commands/graph-visualize.js";
import { runIndex } from "./commands/index.js";
import {
  runCommentsInbox,
  runCommentsList,
  runCommentsPlan,
  runCommentsResolve,
  runCommentsShow,
} from "./commands/comments.js";
import { runProvenanceLink } from "./graph/provenance.js";
import {
  runPrototypeManifest,
  runPrototypeSetup,
  runPrototypeThemes,
  runPrototypeValidate,
} from "./commands/prototype.js";
import type { SectionRegistry } from "./types.js";

const program = new Command();
const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

program
  .name("ai-spector")
  .description(
    "AI Spector — init project, analyze prep, traceability graph, templates, Cursor workflow",
  )
  .version(packageJson.version)
  .option("-r, --root <path>", "Project root (auto-detect via .ai-spector/docflow.config.json)");

program
  .command("version")
  .description("Print ai-spector version")
  .action(() => {
    console.log(packageJson.version);
  });

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
  .command("sync-cursor")
  .description("Refresh .cursor/commands and .cursor/skills from scaffold/cursor/ (no full re-init)")
  .option("-C, --cwd <path>", "Target directory", process.cwd())
  .action(async (opts) => {
    await runSyncCursor({
      targetDir: resolve(opts.cwd ?? process.cwd()),
    });
  });

program
  .command("index")
  .description(
    "Refresh graph, knowledge merge, and doc indexes from current project files",
  )
  .option("--graph-only", "Only registry + bootstrap + merge + validate (no doc indexes)")
  .option("--docs-only", "Only rebuild .ai-spector/index/*.md and state hashes")
  .option("--skip-docs", "Skip .ai-spector/index document indexes")
  .option("--skip-merge", "Skip merging knowledge.json into graph")
  .option(
    "--skip-doc-semantics",
    "Skip parsing docs/srs and docs/basic-design for UC/F/actor ids into the graph",
  )
  .option("--skip-validate", "Skip graph validate after refresh")
  .action(async (opts, cmd) => {
    await runIndex({
      root: projectRootOpt(cmd),
      graphOnly: opts.graphOnly,
      docsOnly: opts.docsOnly,
      skipDocs: opts.skipDocs,
      skipMerge: opts.skipMerge,
      skipDocSemantics: opts.skipDocSemantics,
      skipValidate: opts.skipValidate,
    });
  });

program
  .command("analyze")
  .description(
    "Prepare graph structure (registry + bootstrap). Normally invoked by the analyze skill in Cursor, not the user.",
  )
  .option(
    "--merge",
    "After prep, merge knowledge.json or extract/patch.json into the graph if present",
  )
  .action(async (opts, cmd) => {
    await runAnalyzePrep(projectRootOpt(cmd), { merge: opts.merge });
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
  .option(
    "--semantic",
    "Merge .ai-spector/.docflow/extract/semantic-links.patch.json (agent meaning edges only)",
  )
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
      semantic: opts.semantic,
      graphPath: opts.graph ?? paths.graph,
      writePatch: opts.writePatch,
      validate: !opts.noValidate,
      dryRun: opts.dryRun,
    });
  });

graph
  .command("report")
  .description("Layer health: structure, spec instances, hubs, provenance, semantic links")
  .option("-g, --graph <path>", "Graph path")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    await runGraphReport({
      root: paths.root,
      graphPath: opts.graph ?? paths.graph,
      json: opts.json,
    });
  });

graph
  .command("ensure-bundles")
  .description("Create bundle.source + source files + bundle.business (idempotent)")
  .option("-g, --graph <path>", "Graph path")
  .action(async (opts, cmd) => {
    const paths = await getPaths(cmd);
    const graph = await loadInMemoryGraph(opts.graph ?? paths.graph);
    const result = await ensureHubBundles(graph, paths.root);
    await writeJson(opts.graph ?? paths.graph, graph.toTraceabilityGraph());
    console.log(
      `Source hub: ${result.sourceFiles} file(s); business hub: ${result.domainMembers} domain member(s)`,
    );
    console.log(`Wrote ${opts.graph ?? paths.graph}`);
  });

graph
  .command("link-sources")
  .description(
    "Add derivedFrom edges from domain nodes to docs/data-source paths",
  )
  .option("-g, --graph <path>", "Graph path")
  .action(async (_opts, cmd) => {
    const paths = await getPaths(cmd);
    const result = await runProvenanceLink({
      projectRoot: paths.root,
      graphPath: _opts.graph ?? paths.graph,
    });
    console.log(result.detail);
    if (!result.merged) {
      process.exitCode = 0;
    }
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

const comments = program
  .command("comments")
  .description("Git-backed review comment threads under comments/ (local resolve flow)");

comments
  .command("list")
  .description("List comment threads from comments/{logical_path}/")
  .option("--file <path>", "Filter by logical file path (e.g. srs/01-overview)")
  .option("--status <status>", "open | resolved | all", "open")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    await runCommentsList({
      root: projectRootOpt(cmd),
      filePath: opts.file,
      status: opts.status,
      json: opts.json,
    });
  });

comments
  .command("inbox")
  .description(
    "Thread pick list for IDE chat (C-001…) — JSON includes idePresentation.markdown table",
  )
  .option("--file <path>", "Filter by logical file path")
  .option("--status <status>", "open | resolved | all", "open")
  .option("--json", "JSON output for agents")
  .action(async (opts, cmd) => {
    await runCommentsInbox({
      root: projectRootOpt(cmd),
      filePath: opts.file,
      status: opts.status,
      json: opts.json,
    });
  });

comments
  .command("plan [threadId]")
  .description("Resolve plan: anchor excerpt, graph impact, and IDE workflow hints")
  .option("--pick <id>", "Pick id from inbox (e.g. C-001)")
  .option("--file <path>", "Logical file path when thread id alone is ambiguous")
  .option("--json", "JSON output for agents")
  .action(async (threadId: string | undefined, opts, cmd) => {
    const id = opts.pick ?? threadId;
    if (!id) {
      console.error("Provide <threadId> or --pick C-001");
      process.exitCode = 1;
      return;
    }
    await runCommentsPlan({
      root: projectRootOpt(cmd),
      threadId: id,
      filePath: opts.file,
      pick: opts.pick,
      json: opts.json,
    });
  });

comments
  .command("show <threadId>")
  .description("Show thread metadata, replies, and events")
  .option("--file <path>", "Logical file path when thread id alone is ambiguous")
  .option("--json", "JSON output for agents")
  .action(async (threadId: string, opts, cmd) => {
    await runCommentsShow({
      root: projectRootOpt(cmd),
      threadId,
      filePath: opts.file,
      json: opts.json,
    });
  });

comments
  .command("resolve <threadId>")
  .description("Mark thread resolved in meta_data.json and append events.jsonl")
  .requiredOption("--file <path>", "Logical file path (e.g. srs/04-features/auth)")
  .option("--by <author>", "resolvedBy value recorded in meta_data.json", "local")
  .option("--commit-sha <sha>", "resolvedInCommitSha (defaults to git HEAD)")
  .option("--expected-version <n>", "Optimistic lock on meta_data.json version")
  .option("--dry-run", "Preview resolve without writing files")
  .option("--json", "JSON output for agents")
  .action(async (threadId: string, opts, cmd) => {
    await runCommentsResolve({
      root: projectRootOpt(cmd),
      threadId,
      filePath: opts.file,
      resolvedBy: opts.by,
      commitSha: opts.commitSha,
      expectedVersion:
        opts.expectedVersion != null ? Number(opts.expectedVersion) : undefined,
      dryRun: opts.dryRun,
      json: opts.json,
    });
  });

const prototype = program
  .command("prototype")
  .description("HTML prototype workspace: themes, manifest, validation (static files under prototype/src/)");

prototype
  .command("themes")
  .description("List bundled UI themes from assets/themes/")
  .option("--json", "JSON output")
  .action(async (opts) => {
    await runPrototypeThemes({ json: opts.json });
  });

prototype
  .command("setup")
  .description("Scaffold prototype/, install theme DESIGN.md, seed manifest when list-screens exists")
  .option("--theme <name>", "Theme folder under assets/themes/ (default: vercel or existing manifest)")
  .option("--no-emit-manifest", "Do not rebuild manifest from list-screens.md")
  .option("--force-design", "Overwrite prototype/DESIGN.md from theme")
  .action(async (opts, cmd) => {
    await runPrototypeSetup({
      root: projectRootOpt(cmd),
      theme: opts.theme,
      emitManifest: opts.emitManifest,
      forceDesign: opts.forceDesign,
    });
  });

prototype
  .command("manifest")
  .description("Rebuild prototype/manifest.json and screen-map.json from docs/basic-design/list-screens.md")
  .option("--theme <name>", "Theme name stored in manifest")
  .option("--dry-run", "Print planned manifest without writing")
  .option("--json", "JSON output")
  .action(async (opts, cmd) => {
    await runPrototypeManifest({
      root: projectRootOpt(cmd),
      theme: opts.theme,
      dryRun: opts.dryRun,
      json: opts.json,
    });
  });

prototype
  .command("validate")
  .description("Check manifest, screen docs, and prototype/src/*.html alignment")
  .option("--strict", "Treat missing HTML as errors")
  .option("--skip-external-check", "Do not warn on CDN/font URLs in HTML")
  .option("--json", "JSON output")
  .action(async (opts, cmd) => {
    await runPrototypeValidate({
      root: projectRootOpt(cmd),
      strict: opts.strict,
      json: opts.json,
      skipExternalCheck: opts.skipExternalCheck,
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
  console.error(
    "In Cursor: see .cursor/skills/ai-spector/references/cli-failures.md — agent offers fix, workaround, or pause.",
  );
  process.exit(1);
});
