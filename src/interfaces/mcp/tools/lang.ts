import {
  runLangQueueScan,
  runLangQueuePending,
  runLangQueueFailed,
  runLangQueueResolved,
} from "@/core/operations/lang-queue.js";
import type { LangQueueSchema } from "../schemas.js";
import type { z } from "zod";

export async function toolLangQueue(input: z.infer<typeof LangQueueSchema>) {
  const opts = { root: input.root, lang: input.lang, limit: input.limit };
  const status = input.status ?? "pending";

  const scan = await runLangQueueScan(opts);
  if (scan.skipped) {
    return { skipped: true, skipReason: scan.skipReason, jobs: [] };
  }

  let jobs: unknown[] = [];
  if (status === "pending" || status === "all") {
    jobs = [...jobs, ...(await runLangQueuePending(opts)).map((r) => r.job)];
  }
  if (status === "failed" || status === "all") {
    jobs = [...jobs, ...(await runLangQueueFailed(opts))];
  }
  if (status === "resolved" || status === "all") {
    jobs = [...jobs, ...(await runLangQueueResolved(opts))];
  }

  return {
    skipped: false,
    summary: {
      pending: scan.pendingCount ?? 0,
      enqueued: scan.enqueued ?? 0,
      resolved: scan.resolved ?? 0,
      failed: scan.failed ?? 0,
    },
    status,
    jobs,
  };
}
