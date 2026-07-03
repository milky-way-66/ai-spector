import type { z } from "zod";
import type {
  ContextListSchema,
  ContextRecordSchema,
  ContextResolveSchema,
} from "../schemas.js";
import {
  runContextList,
  runContextRecord,
  runContextResolve,
} from "@/core/operations/context.js";
import { assertToolAllowed } from "../assert-tool-allowed.js";

export async function toolContextList(input: z.infer<typeof ContextListSchema>) {
  await assertToolAllowed("context_list", input.root);
  return runContextList({ root: input.root, docType: input.docType, status: input.status });
}

export async function toolContextRecord(input: z.infer<typeof ContextRecordSchema>) {
  await assertToolAllowed("context_record", input.root);
  return runContextRecord({
    root: input.root,
    docType: input.docType,
    question: input.question,
    answer: input.answer,
    scope: input.scope,
    source: input.source,
    sourceRefs: input.sourceRefs,
    answeredBy: input.by ?? input.answeredBy,
    answeredByUsername: input.username,
    role: input.role,
  });
}

export async function toolContextResolve(input: z.infer<typeof ContextResolveSchema>) {
  await assertToolAllowed("context_resolve", input.root);
  return runContextResolve({
    root: input.root,
    docType: input.docType,
    id: input.id,
    answer: input.answer,
    answeredBy: input.by ?? input.answeredBy,
    answeredByUsername: input.username,
    role: input.role,
  });
}
