import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import {
  filterSourcesByHashChange,
  getGraphifySourceSkipReason,
  isGraphifyNoCodeFilesOutput,
  resolveGraphifyOutputPath,
  resolveGraphifySources,
  type GraphifySourceSkipReason,
  type GraphifySourcesConfig,
} from "../graphify/sources.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";

interface AnalyzeGraphifyConfig {
  version?: number;
  graphify?: GraphifySourcesConfig & {
    outputPath?: string;
    graphJsonPath?: string;
  };
}

export interface GraphifyUpdateOptions {
  root?: string;
  sourcePath?: string;
  removeStaleOutput?: boolean;
  /** Re-run graphify update on all configured sources even when content hash unchanged */
  force?: boolean;
}

export interface GraphifyUpdateResult {
  sourcesRun: string[];
  sourcesSkipped: string[];
  /** Sources skipped because the directory has no files (Graphify would exit 1). */
  sourcesEmptySkipped: string[];
  /** Sources skipped because there are no Graphify code extensions (e.g. markdown-only docs/srs). */
  sourcesNoCodeSkipped: string[];
  sourceHashes: Record<string, string>;
}

function skipReasonMessage(reason: GraphifySourceSkipReason): string {
  switch (reason) {
    case "empty":
      return "empty";
    case "no-code-files":
      return "no code files to index";
  }
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function runGraphifyCli(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number; stdout: string; stderr: string; command: string }> {
  try {
    const direct = await runCommand("graphify", args, cwd, env);
    return { ...direct, command: `graphify ${args.join(" ")}` };
  } catch {
    const uvArgs = ["tool", "run", "--from", "graphifyy", "graphify", ...args];
    const viaUv = await runCommand("uv", uvArgs, cwd, env);
    return { ...viaUv, command: `uv ${uvArgs.join(" ")}` };
  }
}

export async function runGraphifyUpdate(
  opts: GraphifyUpdateOptions = {},
): Promise<GraphifyUpdateResult> {
  const { root: projectRoot } = await loadDocflowConfig(opts.root);
  const configPath = join(projectRoot, ".ai-spector/.docflow/config/analyze.graphify.json");
  const config = await readJson<AnalyzeGraphifyConfig>(configPath);
  const g = config.graphify ?? {};

  const outputPath = resolveGraphifyOutputPath(projectRoot, g.outputPath);

  const statePath = join(projectRoot, ".ai-spector/.docflow/state.json");
  const state = await readJson<Record<string, unknown>>(statePath).catch(() => ({
    version: 1,
    graphify: {},
  }));
  const graphifyState = (state.graphify as Record<string, unknown>) ?? {};
  const storedHashes = graphifyState.sourceHashes as Record<string, string> | undefined;

  let specs = resolveGraphifySources(g);
  if (opts.sourcePath) {
    specs = [{ path: opts.sourcePath, key: opts.sourcePath }];
  }

  const { toRun, hashes } = await filterSourcesByHashChange(
    projectRoot,
    specs,
    storedHashes,
    opts.force === true,
  );

  const sourcesRun: string[] = [];
  const sourcesEmptySkipped: string[] = [];
  const sourcesNoCodeSkipped: string[] = [];
  const sourcesSkipped = specs
    .filter((s) => !toRun.some((r) => r.key === s.key))
    .map((s) => s.path);

  if (toRun.length === 0) {
    console.log("Graphify update: all sources unchanged (use --force to re-index)");
    for (const s of specs) {
      console.log(`  ○ ${s.path} (hash ${hashes[s.key] ?? "—"})`);
    }
    return {
      sourcesRun,
      sourcesSkipped,
      sourcesEmptySkipped,
      sourcesNoCodeSkipped,
      sourceHashes: hashes,
    };
  }

  const env = {
    ...process.env,
    GRAPHIFY_OUT: outputPath,
  };

  console.log(`Graphify update (${toRun.length} source(s), ${sourcesSkipped.length} unchanged)`);
  console.log(`  cwd → ${projectRoot}`);
  console.log(`  GRAPHIFY_OUT → ${outputPath}`);
  console.log("  (do not pass --graph to graphify update — use GRAPHIFY_OUT instead)");
  console.log("");

  for (const spec of toRun) {
    const sourcePath = resolve(projectRoot, spec.path);
    if (!(await pathExists(sourcePath))) {
      console.log(`  ⊘ skip ${spec.path} (not found)`);
      continue;
    }

    const skipReason = await getGraphifySourceSkipReason(projectRoot, spec.path);
    if (skipReason) {
      console.log(`  ⊘ skip ${spec.path} (${skipReasonMessage(skipReason)})`);
      if (skipReason === "empty") {
        sourcesEmptySkipped.push(spec.path);
      } else {
        sourcesNoCodeSkipped.push(spec.path);
      }
      continue;
    }

    console.log(`  ▶ ${spec.path} (hash ${hashes[spec.key] ?? "—"})`);
    const result = await runGraphifyCli(["update", spec.path], projectRoot, env);

    if (result.stdout.trim()) {
      console.log(result.stdout.trimEnd());
    }
    if (result.stderr.trim()) {
      console.error(result.stderr.trimEnd());
    }

    if (
      isGraphifyNoCodeFilesOutput(result.stdout, result.stderr, result.exitCode)
    ) {
      console.log(`  ⊘ skip ${spec.path} (no code files to index)`);
      sourcesNoCodeSkipped.push(spec.path);
      continue;
    }

    if (result.exitCode !== 0) {
      console.error("");
      console.error(`Failed: ${result.command} (exit ${result.exitCode})`);
      throw new Error(`graphify update failed for ${spec.path} (exit ${result.exitCode})`);
    }
    sourcesRun.push(spec.path);
  }

  const graphJson = join(outputPath, "graph.json");
  if (!(await pathExists(graphJson))) {
    throw new Error(
      `Expected graph.json at ${g.graphJsonPath ?? graphJson} after update — check Graphify install (graphify or uv + graphifyy)`,
    );
  }

  const primaryRel = g.defaultDataSource ?? "docs/data-source";
  const primaryAbs = resolve(projectRoot, primaryRel);
  const staleDirs = [
    join(primaryAbs, "graphify-out"),
    join(primaryAbs, ".ai-spector", ".docflow", "graph", "graphify-out"),
  ];
  for (const staleOut of staleDirs) {
    if (opts.removeStaleOutput !== false && (await pathExists(staleOut))) {
      await rm(staleOut, { recursive: true, force: true });
      const rel = staleOut.startsWith(projectRoot)
        ? staleOut.slice(projectRoot.length + 1)
        : staleOut;
      console.log("");
      console.log(`Removed stale ${rel}/ (GRAPHIFY_OUT was relative to source path)`);
    }
  }

  graphifyState.lastRunAt = new Date().toISOString();
  graphifyState.sourceHashes = hashes;
  graphifyState.sourcesRun = sourcesRun;
  state.graphify = graphifyState;
  await writeJson(statePath, state);

  console.log("");
  console.log(`OK — ${g.graphJsonPath ?? ".ai-spector/.docflow/graph/graphify-out/graph.json"}`);
  if (sourcesEmptySkipped.length > 0) {
    console.log(`Skipped (empty): ${sourcesEmptySkipped.join(", ")}`);
  }
  if (sourcesNoCodeSkipped.length > 0) {
    console.log(`Skipped (no code files): ${sourcesNoCodeSkipped.join(", ")}`);
  }
  if (sourcesSkipped.length > 0) {
    console.log(`Skipped (unchanged): ${sourcesSkipped.join(", ")}`);
  }

  return {
    sourcesRun,
    sourcesSkipped,
    sourcesEmptySkipped,
    sourcesNoCodeSkipped,
    sourceHashes: hashes,
  };
}
