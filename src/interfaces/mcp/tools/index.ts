import { runIndex } from "../../../core/operations/index.js";
import type { IndexSchema } from "../schemas.js";
import type { z } from "zod";

export async function toolIndex(input: z.infer<typeof IndexSchema>) {
  const report = await runIndex({
    root: input.root,
    graphOnly: input.graphOnly,
    docsOnly: input.docsOnly,
    skipMerge: input.skipMerge,
    skipValidate: input.skipValidate,
    skipDocSemantics: input.skipDocSemantics,
    cocoindexSync: input.cocoindexSync,
  });
  return report;
}
