import type { z } from "zod";
import type { WorkflowRouteSchema } from "../schemas.js";
import { runWorkflowRoute } from "@/core/operations/workflow-route.js";

export async function toolWorkflowRoute(input: z.infer<typeof WorkflowRouteSchema>) {
  return runWorkflowRoute({ root: input.root, message: input.message });
}
