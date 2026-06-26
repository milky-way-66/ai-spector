import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolveCommentsWriteRoots } from "../../src/core/docops/config.js";

describe("resolveCommentsWriteRoots", () => {
  it("uses paths.comments from docops.config.json only", async () => {
    const root = await mkdtemp(join(tmpdir(), "paths-"));
    await mkdir(join(root, ".docops"), { recursive: true });
    await writeFile(
      join(root, ".docops/docops.config.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        docsRoot: "docs",
        languages: [{ code: "en", label: "English" }],
        primaryLanguage: "en",
        paths: {
          comments: ".docops/comments",
          reviewConfig: ".docops/review.config.json",
          reviewQueue: ".docops/review-queue",
          prototypeConfig: ".docops/prototype/config.json",
          prototypeScreenMap: ".docops/prototype/screen-map.json",
        },
        capabilities: { review: true, comments: true, prototype: true, graph: false, generate: false, translate: false },
      }),
      "utf8",
    );
    const roots = await resolveCommentsWriteRoots(root);
    expect(roots.primary).toBe(".docops/comments");
    expect(roots.legacy).toBeUndefined();
  });
});
