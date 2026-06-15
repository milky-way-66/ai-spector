import type { z } from "zod";
import type { WorkflowStatusSchema } from "../schemas.js";
import { runWorkflowStatusOp } from "@/core/operations/workflow-status.js";

export async function toolWorkflowStatus(input: z.infer<typeof WorkflowStatusSchema>) {
  return runWorkflowStatusOp({ root: input.root });
}
