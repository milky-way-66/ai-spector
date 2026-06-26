import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { logicalPathToDocPath } from "@/core/comments/paths.js";
import { resolveCommentsWriteRoots } from "@/core/docops/config.js";
import {
  resolveDocTypeRepoPath,
  segmentRepoPrefixMap,
} from "@/core/docops/paths.js";

describe("resolveDocTypeRepoPath", () => {
  it("keeps repo-root-relative paths", () => {
    expect(resolveDocTypeRepoPath("docs/srs")).toBe("docs/srs");
    expect(resolveDocTypeRepoPath("detail-design")).toBe("detail-design");
  });

  it("does not expand short segment names under docsRoot", () => {
    expect(resolveDocTypeRepoPath("srs")).toBe("srs");
    expect(resolveDocTypeRepoPath("basic-design")).toBe("basic-design");
  });

  it("normalizes dot segments", () => {
    expect(resolveDocTypeRepoPath("../detail-design")).toBe("detail-design");
  });
});

describe("segmentRepoPrefixMap", () => {
  it("uses docTypes paths from config literally", () => {
    const map = segmentRepoPrefixMap({
      docsRoot: "docs",
      docTypes: {
        srs: { enabled: true, path: "docs/srs" },
        detailDesign: { enabled: true, path: "detail-design" },
      },
    });
    expect(map.srs).toBe("docs/srs");
    expect(map["detail-design"]).toBe("detail-design");
  });

  it("uses example defaults when path is unset", () => {
    const map = segmentRepoPrefixMap({ docsRoot: "docs", docTypes: {} });
    expect(map.srs).toBe("docs/srs");
    expect(map["basic-design"]).toBe("docs/basic-design");
  });
});

describe("logicalPathToDocPath with docops prefixes", () => {
  it("maps logical paths through configured repo folders", () => {
    const prefixes = {
      srs: "docs/srs",
      "basic-design": "docs/basic-design",
      "detail-design": "custom/detail-design",
    };
    expect(logicalPathToDocPath("srs/01-overview", prefixes)).toBe(
      "docs/srs/01-overview.md",
    );
    expect(logicalPathToDocPath("detail-design/feature-list", prefixes)).toBe(
      "custom/detail-design/feature-list.md",
    );
  });
});

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
          registry: ".docops/registry",
          comments: ".docops/comments",
          reviewConfig: ".docops/review.config.json",
          reviewQueue: ".docops/review-queue",
          prototypeConfig: ".docops/prototype/config.json",
          prototypeScreenMap: ".docops/prototype/screen-map.json",
        },
        capabilities: {
          review: true,
          comments: true,
          prototype: true,
          graph: false,
          generate: false,
          translate: false,
        },
      }),
      "utf8",
    );
    const roots = await resolveCommentsWriteRoots(root);
    expect(roots.primary).toBe(".docops/comments");
    expect(roots.legacy).toBeUndefined();
  });
});
