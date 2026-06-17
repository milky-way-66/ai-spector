import { describe, expect, it } from "vitest";
import {
  classifyDetailDesignDetailFile,
  detailDesignDetailFileToPatch,
  detailFileToPatch,
} from "@/core/graph/doc-extract.js";

describe("classifyDetailDesignDetailFile", () => {
  it("classifies feature detail paths and skips list/common", () => {
    expect(classifyDetailDesignDetailFile("docs/detail-design/feature-list.md")).toBeNull();
    expect(
      classifyDetailDesignDetailFile("docs/detail-design/en/common/architecture-overview.md"),
    ).toBeNull();
    expect(
      classifyDetailDesignDetailFile("docs/detail-design/en/features/f-01-checkout.md"),
    ).toBe("featureDetail");
  });
});

describe("detailDesignDetailFileToPatch", () => {
  it("emits doc.dd.f-01 with tracesTo and contains from list", () => {
    const patch = detailDesignDetailFileToPatch(
      "docs/detail-design/en/features/f-01-checkout.md",
      `# Detail Design: Checkout

**Feature Name:** Checkout

## 1. Feature Implementation Overview
`,
    );
    expect(patch.nodes.some((n) => n.id === "doc.dd.f-01")).toBe(true);
    expect(patch.edges).toContainEqual({
      type: "tracesTo",
      from: "F-01",
      to: "doc.dd.f-01",
    });
    expect(patch.edges).toContainEqual({
      type: "contains",
      from: "doc.dd.feature-list",
      to: "doc.dd.f-01",
    });
  });
});

describe("detailFileToPatch routes detail design", () => {
  it("handles detail design after basic design branch", () => {
    const patch = detailFileToPatch(
      "docs/detail-design/en/features/f-02-login.md",
      `**Feature Name:** Login\n\n## 1. Feature Implementation Overview\n`,
    );
    expect(patch.nodes.some((n) => n.id === "doc.dd.f-02")).toBe(true);
  });
});
