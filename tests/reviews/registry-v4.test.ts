import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { migrateReviewRegistryToV4 } from "@/core/reviews/registry-v4.js";
import { getApproval, loadRegistry } from "@/core/reviews/storage.js";
import { DEFAULT_DOCOPS_PATHS } from "@/core/docops/paths.js";
import type { DocopsConfig } from "@/core/docops/types.js";

const ENTITY_ID = "a1b2c3d4-e5f6-4123-abcd-ef1234567890";
const LOGICAL_PATH = "srs/01-overview.md";

function baseConfig(): DocopsConfig {
  return {
    schemaVersion: "1.0",
    docsRoot: "docs",
    languages: [{ code: "en", label: "English" }],
    primaryLanguage: "en",
    paths: { ...DEFAULT_DOCOPS_PATHS },
    capabilities: {
      review: true,
      comments: true,
      prototype: false,
      graph: false,
      generate: false,
      translate: false,
    },
    docTypes: {
      srs: { enabled: true, path: "docs/srs", label: "SRS" },
    },
  };
}

describe("migrateReviewRegistryToV4", () => {
  it("rekeys v3 logicalPath entries to entityId", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-v4-"));
    await mkdir(join(root, ".docops/review-queue"), { recursive: true });
    await mkdir(join(root, ".docops/registry/documents"), { recursive: true });
    await writeFile(
      join(root, ".docops/docops.config.json"),
      JSON.stringify(baseConfig(), null, 2),
    );
    await writeFile(
      join(root, `.docops/registry/documents/${ENTITY_ID}.json`),
      JSON.stringify(
        {
          entityId: ENTITY_ID,
          logicalPath: LOGICAL_PATH,
          repoDocs: { en: `docs/srs/en/${LOGICAL_PATH}` },
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(root, ".docops/review-queue/registry.json"),
      JSON.stringify(
        {
          version: 3,
          documents: {
            [LOGICAL_PATH]: {
              version: 3,
              logicalPath: LOGICAL_PATH,
              contentHash: "abc123",
              overallStatus: "pending_internal",
              internal: { status: "pending", votes: [], quorumMetAt: null, closedAt: null, closedBy: null, invalidatedAt: null, reopenedAt: null },
              client: { status: "pending", votes: [], quorumMetAt: null, closedAt: null, closedBy: null, reopenedAt: null },
            },
          },
        },
        null,
        2,
      ),
    );

    const result = await migrateReviewRegistryToV4(root);
    expect(result.migrated).toBe(true);
    expect(result.rekeyed).toBe(1);

    const registry = await loadRegistry(root);
    expect(registry.version).toBe(4);
    expect(registry.documents[ENTITY_ID]).toBeDefined();
    expect(registry.documents[LOGICAL_PATH]).toBeUndefined();

    const approval = await getApproval(root, LOGICAL_PATH);
    expect(approval?.logicalPath).toBe(LOGICAL_PATH);
    expect(approval?.contentHash).toBe("abc123");
  });
});
