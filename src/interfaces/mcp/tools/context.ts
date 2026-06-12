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
} from "../../../core/operations/context.js";

export async function toolContextList(input: z.infer<typeof ContextListSchema>) {
  return runContextList({ root: input.root, docType: input.docType, status: input.status });
}

export async function toolContextRecord(input: z.infer<typeof ContextRecordSchema>) {
  return runContextRecord({
    root: input.root,
    docType: input.docType,
    question: input.question,
    answer: input.answer,
    scope: input.scope,
    source: input.source,
    sourceRefs: input.sourceRefs,
    answeredBy: input.answeredBy,
  });
}

export async function toolContextResolve(input: z.infer<typeof ContextResolveSchema>) {
  return runContextResolve({
    root: input.root,
    docType: input.docType,
    id: input.id,
    answer: input.answer,
    answeredBy: input.answeredBy,
  });
}
