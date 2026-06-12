import type { z } from "zod";
import type {
  SpecListSchema,
  SpecRecordSchema,
  SpecApproveSchema,
  SpecRejectSchema,
} from "../schemas.js";
import {
  runSpecList,
  runSpecRecord,
  runSpecApprove,
  runSpecReject,
} from "../../../core/operations/extracted.js";
import type { ExtractPatch } from "../../../core/graph/knowledge.js";

export async function toolSpecList(input: z.infer<typeof SpecListSchema>) {
  return runSpecList({ root: input.root, docType: input.docType, status: input.status });
}

export async function toolSpecRecord(input: z.infer<typeof SpecRecordSchema>) {
  return runSpecRecord({
    root: input.root,
    docType: input.docType,
    specs: input.specs.map((s) => ({
      statement: s.statement,
      extractedFrom: s.extractedFrom,
      patch: s.patch as ExtractPatch | undefined,
    })),
  });
}

export async function toolSpecApprove(input: z.infer<typeof SpecApproveSchema>) {
  return runSpecApprove({
    root: input.root,
    docType: input.docType,
    id: input.id,
    by: input.by,
    note: input.note,
    skipMerge: input.skipMerge,
  });
}

export async function toolSpecReject(input: z.infer<typeof SpecRejectSchema>) {
  return runSpecReject({
    root: input.root,
    docType: input.docType,
    id: input.id,
    by: input.by,
    note: input.note,
  });
}
