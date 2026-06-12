import { join, resolve, relative } from "node:path";
import { mkdir, cp, copyFile } from "node:fs/promises";
import { pathExists, readJson } from "../util/fs.js";
import type { TraceabilityGraph } from "@/types.js";
import type { GraphQueryResult } from "../graph/query.js";

// ── Python detection ──────────────────────────────────────────────────────────

export type CocoindexInstallMode = "venv" | "global";

/** Returns the python executable to use for a given cocoindex dir.
 *  Priority: project venv → COCOINDEX_PYTHON env → python3 → python */
export async function findPython(cocoDir: string): Promise<string> {
  const envVar = process.env["COCOINDEX_PYTHON"];
  if (envVar) return envVar;

  // venv inside the cocoindex dir
  const venvBin = process.platform === "win32"
    ? join(cocoDir, ".venv", "Scripts", "python.exe")
    : join(cocoDir, ".venv", "bin", "python");
  if (await pathExists(venvBin)) return venvBin;

  // system python3 / python
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  for (const bin of ["python3", "python"]) {
    try {
      await exec(bin, ["--version"]);
      return bin;
    } catch {
      // not found — try next
    }
  }
  throw new Error(
    "Python not found. CocoIndex requires Python ≥3.11.\n" +
    "  Install: brew install python@3.11  (macOS) or https://python.org\n" +
    "  Or set COCOINDEX_PYTHON=/path/to/python3",
  );
}

/** Returns [command, ...args] for running pipeline.py in MCP mode.
 *  Priority: uv (inline deps, no venv required) → venv python → python3 → python */

/** Check python version is ≥3.11. Returns version string or null on failure. */
export async function checkPythonVersion(bin: string): Promise<string | null> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const { stdout } = await exec(bin, ["--version"]);
    return stdout.trim().replace(/^Python /, "");
  } catch {
    return null;
  }
}

// ── Config helpers ────────────────────────────────────────────────────────────

export function cocoindexDir(root: string): string {
  return join(root, ".ai-spector/.docflow/cocoindex");
}

export function cocoindexPipelinePath(root: string): string {
  return join(cocoindexDir(root), "pipeline.py");
}

export async function isCocoindexConfigured(root: string): Promise<boolean> {
  return pathExists(cocoindexPipelinePath(root));
}

export interface CocoindexReadiness {
  configured: boolean;   // pipeline.py exists
  pythonBin: string | null;
  pythonVersion: string | null;
  depsInstalled: boolean;
  indexed: boolean;      // lancedb_data/ exists
}

export async function checkCocoindexReadiness(root: string): Promise<CocoindexReadiness> {
  const dir = cocoindexDir(root);
  const configured = await pathExists(cocoindexPipelinePath(root));

  if (!configured) {
    return { configured: false, pythonBin: null, pythonVersion: null, depsInstalled: false, indexed: false };
  }

  let pythonBin: string | null = null;
  let pythonVersion: string | null = null;
  let depsInstalled = false;

  try {
    pythonBin = await findPython(dir);
    pythonVersion = await checkPythonVersion(pythonBin);
  } catch {
    // python not found
  }

  if (pythonBin) {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const exec = promisify(execFile);
      await exec(pythonBin, ["-c", "import cocoindex"]);
      depsInstalled = true;
    } catch {
      depsInstalled = false;
    }
  }

  const indexed = await pathExists(join(dir, "lancedb_data"));

  return { configured, pythonBin, pythonVersion, depsInstalled, indexed };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export interface CocoindexSetupOptions {
  root?: string;
  force?: boolean;
  /** "venv" creates .venv inside cocoindex dir; "global" uses system pip3/pip */
  installMode?: CocoindexInstallMode;
  /** If true, install Python deps and copy .env */
  installDeps?: boolean;
}

export interface CocoindexSetupResult {
  pipelinePath: string;
  envPath: string;
  alreadyExists: boolean;
  depsInstalled: boolean;
  installError?: string;
}

export async function runCocoindexSetup(
  opts: CocoindexSetupOptions = {},
): Promise<CocoindexSetupResult> {
  const root = resolve(opts.root ?? process.cwd());
  const destDir = cocoindexDir(root);
  const pipelinePath = join(destDir, "pipeline.py");
  const envExample = join(destDir, ".env.example");
  const envPath = join(destDir, ".env");

  const alreadyExists = await pathExists(pipelinePath);
  if (!alreadyExists || opts.force) {
    const { scaffoldBundleRoot } = await import("../config/load.js");
    const scaffoldSrc = join(scaffoldBundleRoot(), "cocoindex");
    await mkdir(destDir, { recursive: true });
    await cp(scaffoldSrc, destDir, { recursive: true });
  }

  // Copy .env.example → .env if .env doesn't exist yet
  if (!(await pathExists(envPath)) && await pathExists(envExample)) {
    await copyFile(envExample, envPath);
  }

  if (!opts.installDeps) {
    return { pipelinePath, envPath, alreadyExists, depsInstalled: false };
  }

  // Install Python deps
  const mode = opts.installMode ?? "venv";
  let depsInstalled = false;
  let installError: string | undefined;

  try {
    const { execFile, spawn } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);

    /** Run a command with visible output (inherit stdio). */
    const spawnVisible = (cmd: string, args: string[], cwd: string): Promise<void> =>
      new Promise((res, rej) => {
        const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
        child.on("error", rej);
        child.on("close", (code) => code === 0 ? res() : rej(new Error(`${cmd} exited with code ${code}`)));
      });

    // Prefer uv sync (creates .venv from pyproject.toml, cached — fast on repeat)
    let usedUv = false;
    try {
      await exec("uv", ["--version"]);
      process.stdout.write("  Installing CocoIndex dependencies with uv…\n");
      await spawnVisible("uv", ["sync"], destDir);
      usedUv = true;
    } catch {
      // uv not available — fall through to pip
    }

    if (!usedUv) {
      const pythonBin = await findPython(destDir);
      const reqFile = join(destDir, "requirements.txt");
      if (mode === "venv") {
        const venvDir = join(destDir, ".venv");
        if (!await pathExists(venvDir) || opts.force) {
          process.stdout.write("  Creating Python venv…\n");
          await spawnVisible(pythonBin, ["-m", "venv", venvDir], destDir);
        }
        const venvPip = process.platform === "win32"
          ? join(venvDir, "Scripts", "pip.exe")
          : join(venvDir, "bin", "pip");
        process.stdout.write("  Installing CocoIndex dependencies into venv…\n");
        await spawnVisible(venvPip, ["install", "-r", reqFile], destDir);
      } else {
        // global — use pip3 with --break-system-packages fallback for PEP 668
        process.stdout.write("  Installing CocoIndex dependencies globally…\n");
        const pip = process.platform === "win32" ? "pip" : "pip3";
        try {
          await spawnVisible(pip, ["install", "-r", reqFile], destDir);
        } catch {
          await spawnVisible(pip, ["install", "--break-system-packages", "-r", reqFile], destDir);
        }
      }
    }
    depsInstalled = true;
  } catch (err) {
    installError = err instanceof Error ? err.message : String(err);
  }

  // Write MCP entry into project .mcp.json so Cursor/Claude picks up the server
  await writeCocoindexMcpEntry(root, pipelinePath, destDir);

  return { pipelinePath, envPath, alreadyExists, depsInstalled, installError };
}

/** Merge the cocoindex MCP server entry into <root>/.mcp.json */
async function writeCocoindexMcpEntry(root: string, pipelinePath: string, cocoDir: string): Promise<void> {
  const { writeJson } = await import("../util/fs.js");
  const entry = {
    command: await findPython(cocoDir),
    args: [join(cocoDir, "server.py")],
    env: {
      AI_SPECTOR_ROOT: root,
      COCOINDEX_DB: join(cocoDir, "cocoindex_state"),
    },
  };

  // Write to all MCP config files that exist or should be created
  const mcpFiles = [
    join(root, ".mcp.json"),           // Claude Code
    join(root, ".cursor", "mcp.json"), // Cursor
  ];

  for (const mcpPath of mcpFiles) {
    // .cursor/mcp.json — only if .cursor/ dir exists
    if (mcpPath.includes(".cursor") && !(await pathExists(join(root, ".cursor")))) {
      continue;
    }
    // root .mcp.json — only if it already exists (don't create it for cursor-only projects)
    if (!mcpPath.includes(".cursor") && !(await pathExists(mcpPath))) {
      continue;
    }
    const existing = await readJson<{ mcpServers?: Record<string, unknown> }>(mcpPath).catch(() => ({} as { mcpServers?: Record<string, unknown> }));
    await writeJson(mcpPath, {
      ...existing,
      mcpServers: { ...(existing.mcpServers ?? {}), "ai-spector-cocoindex": entry },
    });
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  docPath: string;
  heading: string;
  excerpt: string;
  score: number;
  graphNodeId?: string;
}

export interface CocoindexSearchOptions {
  root?: string;
  query: string;
  limit?: number;
  threshold?: number;
}

export interface CocoindexSearchResult {
  query: string;
  results: SearchResult[];
  cocoindexConfigured: boolean;
}

export async function runCocoindexSearch(
  opts: CocoindexSearchOptions,
): Promise<CocoindexSearchResult> {
  const root = resolve(opts.root ?? process.cwd());
  const configured = await isCocoindexConfigured(root);

  if (!configured) {
    return { query: opts.query, results: [], cocoindexConfigured: false };
  }

  const pipelinePath = cocoindexPipelinePath(root);
  const limit = opts.limit ?? 5;
  const threshold =
    opts.threshold ??
    Number(process.env["COCOINDEX_SIMILARITY_THRESHOLD"] ?? "0.35");

  const rawResults = await spawnPythonSearch(root, pipelinePath, opts.query, limit, threshold);
  const enriched = await enrichWithGraphNodeIds(root, rawResults);

  return { query: opts.query, results: enriched, cocoindexConfigured: true };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface CocoindexStatsResult {
  cocoindexConfigured: boolean;
  chunkCount: number;
  fileCount: number;
  files: string[];
  error?: string;
}

/** Embedding-store diagnostics via `pipeline.py stats` (chunk/file counts, embedded paths). */
export async function runCocoindexStats(
  opts: { root?: string } = {},
): Promise<CocoindexStatsResult> {
  const root = resolve(opts.root ?? process.cwd());
  if (!(await isCocoindexConfigured(root))) {
    return { cocoindexConfigured: false, chunkCount: 0, fileCount: 0, files: [] };
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  const dir = cocoindexDir(root);
  const pythonBin = await findPython(dir);
  const { stdout } = await exec(pythonBin, [cocoindexPipelinePath(root), "stats"], {
    cwd: root,
    env: { ...process.env, AI_SPECTOR_ROOT: root },
    maxBuffer: 4 * 1024 * 1024,
  });

  const parsed = JSON.parse(stdout) as {
    chunkCount?: number;
    fileCount?: number;
    files?: string[];
    error?: string;
  };
  return {
    cocoindexConfigured: true,
    chunkCount: parsed.chunkCount ?? 0,
    fileCount: parsed.fileCount ?? 0,
    files: parsed.files ?? [],
    ...(parsed.error ? { error: parsed.error } : {}),
  };
}

// ── Python bridge ─────────────────────────────────────────────────────────────

interface PythonSearchResult {
  docPath: string;
  heading: string;
  excerpt: string;
  score: number;
}

async function spawnPythonSearch(
  root: string,
  pipelinePath: string,
  query: string,
  limit: number,
  threshold: number,
): Promise<PythonSearchResult[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  const dir = cocoindexDir(root);
  let pythonBin: string;
  try {
    pythonBin = await findPython(dir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg);
  }

  const args = [
    pipelinePath,
    "search",
    "--query", query,
    "--limit", String(limit),
    "--threshold", String(threshold),
  ];

  const { stdout } = await exec(pythonBin, args, {
    cwd: root,
    env: { ...process.env, AI_SPECTOR_ROOT: root },
    maxBuffer: 1024 * 1024,
  });

  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? (parsed as PythonSearchResult[]) : [];
  } catch {
    return [];
  }
}

// ── Graph node enrichment ─────────────────────────────────────────────────────

async function enrichWithGraphNodeIds(
  root: string,
  results: PythonSearchResult[],
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  let nodeFileMap: Map<string, string> | null = null;
  try {
    const { loadDocflowConfig } = await import("../config/load.js");
    const { config } = await loadDocflowConfig(root);
    const graph = await readJson<TraceabilityGraph>(join(root, config.paths.graph));
    nodeFileMap = new Map<string, string>();
    for (const node of graph.nodes) {
      // Document nodes record their markdown path in `output`; `file` kept as
      // a fallback for older graphs.
      const file =
        (node as { output?: string; file?: string }).output ??
        (node as { file?: string }).file;
      if (file) {
        const rel = relative(root, resolve(root, file)).replace(/\\/g, "/");
        nodeFileMap.set(rel, node.id);
      }
    }
  } catch {
    // graph unavailable — skip enrichment
  }

  return results.map((r) => {
    const docPath = r.docPath.replace(/\\/g, "/");
    const graphNodeId = nodeFileMap
      ? (nodeFileMap.get(docPath) ??
        nodeFileMap.get(relative(root, resolve(root, docPath)).replace(/\\/g, "/")))
      : undefined;
    return { ...r, graphNodeId };
  });
}

// ── Fuzzy graph query ─────────────────────────────────────────────────────────

export interface FuzzyQueryOptions {
  root?: string;
  query: string;
  direction?: "out" | "in" | "both";
  depth?: number;
  threshold?: number;
}

export interface FuzzyQueryResult {
  resolvedNodeId: string;
  resolvedVia: string;
  confidence: number;
  subgraph: GraphQueryResult;
}

export async function runGraphQueryFuzzy(
  opts: FuzzyQueryOptions,
): Promise<FuzzyQueryResult> {
  const root = resolve(opts.root ?? process.cwd());

  const searchResult = await runCocoindexSearch({
    root,
    query: opts.query,
    limit: 5,
    threshold: opts.threshold,
  });

  if (!searchResult.cocoindexConfigured) {
    throw new Error(
      "CocoIndex is not configured. Run: npx ai-spector cocoindex setup",
    );
  }

  const topHit = searchResult.results.find((r) => r.graphNodeId);
  if (!topHit?.graphNodeId) {
    throw new Error(
      `No graph node found for query "${opts.query}". ` +
        "Try a more specific query or use graph_query with an exact node id.",
    );
  }

  const { loadDocflowConfig } = await import("../config/load.js");
  const { config } = await loadDocflowConfig(root);
  const { runGraphQuery } = await import("./graph-query.js");

  const subgraph = await runGraphQuery({
    graphPath: join(root, config.paths.graph),
    seedId: topHit.graphNodeId,
    direction: opts.direction,
    depth: opts.depth,
  });

  return {
    resolvedNodeId: topHit.graphNodeId,
    resolvedVia: `docs_search → ${topHit.docPath} § ${topHit.heading}`,
    confidence: topHit.score,
    subgraph,
  };
}
