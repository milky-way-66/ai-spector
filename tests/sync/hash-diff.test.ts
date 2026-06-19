import { describe, expect, it } from "vitest";
import { diffLayerFileMaps } from "@/core/sync/hash-diff.js";
import type { BaselineFileEntry } from "@/core/sync/types.js";

const entry = (hash: string): BaselineFileEntry => ({ hash, sizeBytes: 10 });

describe("diffLayerFileMaps", () => {
  it("detects modified, added, deleted", () => {
    const baseline = {
      "docs/srs/a.md": entry("1111"),
      "docs/srs/b.md": entry("2222"),
    };
    const current = {
      "docs/srs/a.md": entry("9999"),
      "docs/srs/c.md": entry("3333"),
    };
    const result = diffLayerFileMaps(baseline, current);
    expect(result.modified.map((f) => f.path)).toEqual(["docs/srs/a.md"]);
    expect(result.added.map((f) => f.path)).toEqual(["docs/srs/c.md"]);
    expect(result.deleted.map((f) => f.path)).toEqual(["docs/srs/b.md"]);
    expect(result.unchanged).toBe(0);
  });
});
