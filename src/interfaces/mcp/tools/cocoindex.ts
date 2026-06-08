import {
  runCocoindexSearch,
  isCocoindexConfigured,
} from "../../../core/operations/cocoindex.js";
import type { DocsSearchSchema } from "../schemas.js";
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
