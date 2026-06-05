import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { writeJson } from "../util/fs.js";
import { collectGitDiff } from "../util/git-diff.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { computeImpact, loadImpactRules, mergeImpactResults } from "../graph/impact.js";
import {
  parseGitDiffRegions,
  pickPrimaryImpactOrigin,
  resolveFromGitDiff,
  resolveImpactOrigins,
  type ResolvedOrigin,
} from "../graph/resolve.js";

export interface GraphImpactCliOptions {
  graphPath: string;
  rulesPath: string;
  projectRoot: string;
  originId?: string;
  file?: string;
  heading?: string;
  git?: boolean;
  change: string;
  output?: string;
  json?: boolean;
}

const PER_DOMAIN_FILE_RE = /(?:\/|^)(uc|f|ent)-\d+[_-]/i;

function buildResolveFailureHint(
  opts: Pick<GraphImpactCliOptions, "file" | "heading" | "originId">,
): string {
  const file = opts.file?.trim();
  if (file && PER_DOMAIN_FILE_RE.test(file) && !opts.heading?.trim()) {
    const slug = file.split("/").pop() ?? file;
    const ucMatch = slug.match(/^(uc|f)-?(\d+)/i);
    const nodeHint = ucMatch ? ` or \`graph impact UC-${ucMatch[2]}\`` : "";
    return (
      `Could not resolve impact origin for per-domain projection file: ${file}\n` +
      `Per-UC/feature projection files require a heading or domain node id to scope the seed.\n` +
      `Use one of:\n` +
      `  npx ai-spector graph impact --git --json                               (recommended)\n` +
      `  npx ai-spector graph impact --file ${file} --heading "<heading text>" --json\n` +
      `  npx ai-spector graph impact <nodeId> --json${nodeHint}`
    );
  }
  return "Could not resolve impact origin. Provide <nodeId>, --file <path> [--heading <text>], or --git.";
}

export function resolveImpactOriginId(
  g: Awaited<ReturnType<typeof loadInMemoryGraph>>,
  opts: Pick<GraphImpactCliOptions, "originId" | "file" | "heading">,
): { originId: string; resolved?: ResolvedOrigin } {
  if (opts.originId?.trim()) {
    const id = opts.originId.trim();
    if (!g.nodesById.has(id)) {
      throw new Error(`Unknown node id: ${id}`);
    }
    return { originId: id };
  }

  const origins = resolveImpactOrigins(g, {
    file: opts.file,
    heading: opts.heading,
    nodeId: opts.originId,
  });
  const primary = pickPrimaryImpactOrigin(origins);
  if (!primary) {
    const hint = buildResolveFailureHint(opts);
    throw new Error(hint);
  }
  return { originId: primary.id, resolved: primary };
}

export async function runGraphImpactFromGit(
  g: Awaited<ReturnType<typeof loadInMemoryGraph>>,
  opts: GraphImpactCliOptions,
): Promise<void> {
  const collected = await collectGitDiff(opts.projectRoot);
  if (collected.notRepo) {
    throw new Error(
      "Not a git repository. Describe the change (/impact <description>) or select text in the editor.",
    );
  }
  if (collected.empty) {
    throw new Error(
      "No unstaged or staged changes. Describe the change (/impact <description>) or select text in the editor.",
    );
  }

  const origins = resolveFromGitDiff(g, collected.diff);
  if (origins.length === 0) {
    const files = parseGitDiffRegions(collected.diff).map((r) => r.file);
    const noImpact = {
      origin: { id: "(git diff)", type: "none", change: opts.change },
      regenerate: [],
      review: [],
      affectedOutputPaths: [],
      noTraceabilityImpact: true,
      changedFiles: files,
    };
    if (opts.json || opts.output) {
      if (opts.output) {
        await mkdir(dirname(opts.output), { recursive: true });
        await writeJson(opts.output, noImpact);
      }
      console.log(JSON.stringify(noImpact, null, 2));
    } else {
      const fileList = files.length > 0 ? files.join(", ") : "(none matched)";
      console.log(`No traceability impact found.\nChanged files not in graph: ${fileList}`);
    }
    return;
  }

  const rules = await loadImpactRules(opts.rulesPath);
  const regions = parseGitDiffRegions(collected.diff);
  const seedsByRegion: ResolvedOrigin[] = [];

  for (const region of regions) {
    const regionOrigins = resolveImpactOrigins(g, {
      file: region.file,
      heading: region.heading,
      sectionAnchor: region.sectionAnchor,
    });
    const primary = pickPrimaryImpactOrigin(regionOrigins);
    if (primary) {
      seedsByRegion.push(primary);
    }
  }

  const uniqueSeeds = new Map<string, ResolvedOrigin>();
  for (const o of seedsByRegion.length > 0 ? seedsByRegion : origins) {
    if (!uniqueSeeds.has(o.id)) {
      uniqueSeeds.set(o.id, o);
    }
  }

  const results = [...uniqueSeeds.values()].map((seed) => {
    const result = computeImpact(g, seed.id, opts.change, rules);
    result.resolvedFrom = seed;
    return result;
  });

  const gitSeeds = [...uniqueSeeds.values()].map((s) => {
    const region = regions.find(
      (r) =>
        resolveImpactOrigins(g, {
          file: r.file,
          heading: r.heading,
          sectionAnchor: r.sectionAnchor,
        }).some((o) => o.id === s.id),
    );
    return {
      id: s.id,
      type: s.type,
      reason: s.reason,
      file: region?.file,
      heading: region?.heading,
    };
  });

  const result =
    results.length === 1
      ? { ...results[0], gitSeeds }
      : mergeImpactResults(results, gitSeeds);

  if (opts.output) {
    await mkdir(dirname(opts.output), { recursive: true });
    await writeJson(opts.output, result);
  }

  if (opts.json || opts.output) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Impact from git diff (${uniqueSeeds.size} seed(s))`);
  for (const bucket of ["regenerate", "review"] as const) {
    const entries = result[bucket];
    console.log(`\n${bucket}:`);
    if (entries.length === 0) {
      console.log("  (none)");
      continue;
    }
    for (const e of entries) {
      const path = e.projectionPath ? ` → ${e.projectionPath}` : "";
      console.log(`  - ${e.id} (${e.type})${path}`);
    }
  }
  if (result.affectedOutputPaths.length > 0) {
    console.log("\naffected output paths:");
    for (const p of result.affectedOutputPaths) {
      console.log(`  - ${p}`);
    }
  }
  if (result.staleTranslations && result.staleTranslations.length > 0) {
    console.log("\nstale translations (may need update):");
    for (const e of result.staleTranslations) {
      console.log(`  - ${e.id} (${e.reason})`);
    }
  }
}

export async function runGraphImpact(opts: GraphImpactCliOptions): Promise<void> {
  const g = await loadInMemoryGraph(opts.graphPath);

  if (opts.git) {
    await runGraphImpactFromGit(g, opts);
    return;
  }

  const { originId, resolved } = resolveImpactOriginId(g, opts);
  const rules = await loadImpactRules(opts.rulesPath);
  const result = computeImpact(g, originId, opts.change, rules);
  if (resolved) {
    result.resolvedFrom = resolved;
  }

  if (opts.output) {
    await mkdir(dirname(opts.output), { recursive: true });
    await writeJson(opts.output, result);
  }

  if (opts.json || opts.output) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Impact from ${result.origin.id} (${result.origin.change})`);
  for (const bucket of ["regenerate", "review"] as const) {
    const entries = result[bucket];
    console.log(`\n${bucket}:`);
    if (entries.length === 0) {
      console.log("  (none)");
      continue;
    }
    for (const e of entries) {
      const path = e.projectionPath ? ` → ${e.projectionPath}` : "";
      console.log(`  - ${e.id} (${e.type})${path}`);
    }
  }
  if (result.affectedOutputPaths.length > 0) {
    console.log("\naffected output paths:");
    for (const p of result.affectedOutputPaths) {
      console.log(`  - ${p}`);
    }
  }
  if (result.staleTranslations && result.staleTranslations.length > 0) {
    console.log("\nstale translations (may need update):");
    for (const e of result.staleTranslations) {
      console.log(`  - ${e.id} (${e.reason})`);
    }
  }
}
