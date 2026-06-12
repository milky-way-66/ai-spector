import type { z } from "zod";
import type { WorkspaceCheckSchema } from "../schemas.js";
import { runCheck } from "../../../core/operations/check.js";

export async function toolWorkspaceCheck(input: z.infer<typeof WorkspaceCheckSchema>) {
  return runCheck({ root: input.root, fix: input.fix, paths: input.paths });
}
