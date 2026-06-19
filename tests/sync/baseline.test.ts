import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  baselinePath,
  loadBaseline,
  saveBaseline,
  type SyncBaseline,
} from "@/core/sync/baseline.js";

describe("sync baseline", () => {
  it("round-trips baseline.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-"));
    await mkdir(join(root, ".ai-spector/.docflow/sync"), { recursive: true });

    const baseline: SyncBaseline = {
      version: 1,
      createdAt: "2026-06-19T10:00:00Z",
      label: "test",
      gitRef: "abc123",
      gitRefType: "commit",
      graphHash: "deadbeef",
      layers: {
        srs: { root: "docs/srs", files: {} },
        "basic-design": { root: "docs/basic-design", files: {} },
        "detail-design": { root: "docs/detail-design", files: {} },
      },
      totals: { files: 0, bytes: 0 },
    };

    await saveBaseline(root, baseline);
    const loaded = await loadBaseline(root);
    expect(loaded?.label).toBe("test");
    expect(baselinePath(root)).toContain("baseline.json");
  });

  it("returns null when baseline missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-missing-"));
    expect(await loadBaseline(root)).toBeNull();
  });
});
