import {
  runCocoindexSearch,
  runGraphQueryFuzzy,
  isCocoindexConfigured,
} from "../../../core/operations/cocoindex.js";
import type { DocsSearchSchema, GraphQueryFuzzySchema } from "../schemas.js";
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
