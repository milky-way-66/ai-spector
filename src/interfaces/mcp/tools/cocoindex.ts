import { join } from "node:path";
import {
  runCocoindexSearch,
  runCocoindexStats,
  runGraphQueryFuzzy,
  isCocoindexConfigured,
  checkCocoindexReadiness,
  cocoindexDir,
  cocoindexPipelinePath,
  findPython,
} from "@/core/operations/cocoindex.js";
import { loadDocflowConfig } from "@/core/config/load.js";
import type {
  DocsSearchSchema,
  GraphQueryFuzzySchema,
  CocoindexStatusSchema,
  CocoindexStatsSchema,
  CocoindexIndexSchema,
} from "../schemas.js";
import type { z } from "zod";

export async function toolDocsSearch(input: z.infer<typeof DocsSearchSchema>) {
  const root = input.root;
  const configured = await isCocoindexConfigured(root ?? process.cwd());

  if (!configured) {
    return {
      error: "CocoIndex not set up. Run: npx ai-spector cocoindex setup",
      cocoindexConfigured: false,
    };
  }

  const result = await runCocoindexSearch({
    root,
    query: input.query,
    limit: input.limit,
    threshold: input.threshold,
  });

  return result;
}

export async function toolCocoindexStatus(input: z.infer<typeof CocoindexStatusSchema>) {
  const { root: projectRoot } = await loadDocflowConfig(input.root);
  const readiness = await checkCocoindexReadiness(projectRoot);

  if (!readiness.configured) {
    return {
      configured: false,
      message: "CocoIndex not set up. Run: npx ai-spector cocoindex setup",
    };
  }

  const issues: string[] = [];
  if (!readiness.pythonBin) issues.push("Python not found (need Python 3.11+)");
  else if (!readiness.pythonVersion) issues.push("Could not determine Python version");
  if (!readiness.depsInstalled) issues.push("Dependencies not installed — run: npx ai-spector cocoindex setup");
  if (!readiness.indexed) issues.push("Index not built yet — run: cocoindex_index or npx ai-spector cocoindex index");

  // Embedding-store stats (best-effort): an "indexed" flag based only on the
  // lancedb_data dir existing is misleading when the table has zero rows.
  let chunkCount: number | undefined;
  let fileCount: number | undefined;
  let sampleFilenames: string[] | undefined;
  if (readiness.indexed && readiness.depsInstalled) {
    try {
      const stats = await runCocoindexStats({ root: projectRoot });
      chunkCount = stats.chunkCount;
      fileCount = stats.fileCount;
      sampleFilenames = stats.files.slice(0, 10);
      if (stats.error) {
        issues.push(`Embedding store unreadable: ${stats.error}`);
      } else if (stats.chunkCount === 0) {
        issues.push("Embedding store is empty — run cocoindex_index to embed docs");
      }
    } catch (err) {
      issues.push(
        `Could not read embedding stats: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    configured: true,
    pythonBin: readiness.pythonBin,
    pythonVersion: readiness.pythonVersion,
    depsInstalled: readiness.depsInstalled,
    indexed: readiness.indexed,
    ...(chunkCount !== undefined ? { chunkCount } : {}),
    ...(fileCount !== undefined ? { fileCount } : {}),
    ...(sampleFilenames !== undefined ? { sampleFilenames } : {}),
    ready: issues.length === 0,
    issues,
  };
}

export async function toolCocoindexStats(input: z.infer<typeof CocoindexStatsSchema>) {
  const { root: projectRoot } = await loadDocflowConfig(input.root);
  return runCocoindexStats({ root: projectRoot });
}

export async function toolCocoindexIndex(input: z.infer<typeof CocoindexIndexSchema>) {
  const { root: projectRoot } = await loadDocflowConfig(input.root);
  const readiness = await checkCocoindexReadiness(projectRoot);

  if (!readiness.configured) {
    throw new Error("CocoIndex not set up. Run: npx ai-spector cocoindex setup");
  }
  if (!readiness.depsInstalled) {
    throw new Error("CocoIndex dependencies not installed. Run: npx ai-spector cocoindex setup");
  }

  const cocoDir = cocoindexDir(projectRoot);
  const pipelinePath = cocoindexPipelinePath(projectRoot);
  const pythonBin = await findPython(cocoDir);

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  try {
    const { stdout, stderr } = await exec(pythonBin, [pipelinePath, "update"], {
      cwd: cocoDir,
      env: {
        ...process.env,
        AI_SPECTOR_ROOT: projectRoot,
        COCOINDEX_DB: join(cocoDir, "cocoindex_state"),
      },
    });
    return { updated: true, output: stdout || stderr || "Index updated." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`CocoIndex update failed: ${msg}`);
  }
}

export async function toolGraphQueryFuzzy(input: z.infer<typeof GraphQueryFuzzySchema>) {
  const configured = await isCocoindexConfigured(input.root ?? process.cwd());

  if (!configured) {
    return {
      error: "CocoIndex not set up. Run: npx ai-spector cocoindex setup",
      cocoindexConfigured: false,
    };
  }

  try {
    const result = await runGraphQueryFuzzy({
      root: input.root,
      query: input.query,
      direction: input.direction,
      depth: input.depth,
      threshold: input.threshold,
    });
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
