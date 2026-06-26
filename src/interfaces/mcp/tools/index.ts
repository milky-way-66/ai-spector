import { runIndex } from "@/core/operations/index.js";
import type { IndexSchema } from "../schemas.js";
import type { z } from "zod";
import { assertToolAllowed } from "../assert-tool-allowed.js";

export async function toolIndex(input: z.infer<typeof IndexSchema>) {
  await assertToolAllowed("index", input.root);
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
