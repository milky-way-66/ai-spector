import type { z } from "zod";
import { runSyncSnapshot } from "@/core/sync/snapshot.js";
import { runSyncAudit } from "@/core/sync/audit.js";
import type { SyncAuditSchema, SyncSnapshotSchema } from "../schemas.js";

export async function toolSyncSnapshot(input: z.infer<typeof SyncSnapshotSchema>) {
  return runSyncSnapshot({
    root: input.root,
    label: input.label,
    gitRef: input.gitRef,
    force: input.force,
  });
}

export async function toolSyncAudit(input: z.infer<typeof SyncAuditSchema>) {
  return runSyncAudit({
    root: input.root,
    failOnDrift: input.failOnDrift,
    direction: input.direction,
    verifyGitRef: input.verifyGitRef,
  });
}
