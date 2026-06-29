import type { z } from "zod";
import { lifecycleSyncResult } from "@/core/operations/lifecycle.js";
import type { LifecycleSyncSchema } from "../schemas.js";

export async function toolLifecycleSync(input: z.infer<typeof LifecycleSyncSchema>) {
  return lifecycleSyncResult({ root: input.root, dryRun: input.dryRun });
}
