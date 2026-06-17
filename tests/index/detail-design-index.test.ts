import { describe, expect, it } from "vitest";
import { buildDocIndex, DOC_INDEX_DEFAULT_OUTPUTS } from "@/core/index/docs-build.js";

describe("detail design doc index", () => {
  it("includes detailDesign in default outputs", () => {
    expect(DOC_INDEX_DEFAULT_OUTPUTS.detailDesign).toBe(
      ".ai-spector/index/detail-design.md",
    );
  });

  it("builds index markdown for detail design files", async () => {
    const built = await buildDocIndex({
      kind: "detailDesign",
      config: {
        outputs: {
          srs: ".ai-spector/index/srs.md",
          basicDesign: ".ai-spector/index/basic-design.md",
          detailDesign: ".ai-spector/index/detail-design.md",
        },
        sources: { detailDesign: { root: "docs/detail-design" } },
      },
      projectRoot: "/tmp",
      files: [
        {
          relativePath: "docs/detail-design/en/feature-list.md",
          absolutePath: "/tmp/docs/detail-design/en/feature-list.md",
          basename: "feature-list.md",
          sizeBytes: 10,
          contentHash: "abc",
        },
      ],
      graph: null,
    });
    expect(built.title).toContain("Detail Design");
    expect(built.markdown).toContain("feature-list.md");
  });
});
