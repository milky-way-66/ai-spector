import { describe, expect, it } from "vitest";
import {
  classifyBasicDesignDetailFile,
  classifyDetailDesignDetailFile,
  detailDesignDetailFileToPatch,
  detailFileToPatch,
  documentIdForBasicDesignFile,
  documentIdForDetailDesignFile,
  documentIdForSrsFile,
} from "@/core/graph/doc-extract.js";

describe("classifyDetailDesignDetailFile", () => {
  it("classifies feature detail paths and skips list/common registry chapters", () => {
    expect(classifyDetailDesignDetailFile("docs/detail-design/feature-list.md")).toBeNull();
    expect(
      classifyDetailDesignDetailFile("docs/detail-design/en/common/architecture-overview.md"),
    ).toBeNull();
    expect(
      classifyDetailDesignDetailFile("docs/detail-design/en/features/f-01-checkout.md"),
    ).toBe("featureDetail");
    expect(
      classifyDetailDesignDetailFile("docs/detail-design/vi/modules/f-02-auth.md"),
    ).toBe("featureDetail");
  });

  it("indexes other detail-design markdown as documentDetail", () => {
    expect(
      classifyDetailDesignDetailFile("docs/detail-design/en/guides/onboarding.md"),
    ).toBe("documentDetail");
    expect(documentIdForDetailDesignFile("docs/detail-design/en/guides/onboarding.md")).toBe(
      "doc.dd.doc-en-guides-onboarding",
    );
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

describe("detailDesignDetailFileToPatch basic-design references", () => {
  it("resolves api/auth.md links to doc.bd.api-auth", () => {
    const patch = detailDesignDetailFileToPatch(
      "docs/detail-design/vi/features/f-01-auth.md",
      `# Detail Design: Auth

**Feature Name:** Auth

## Related Documents
- [api/auth.md](../../../basic-design/vi/api/auth.md)
`,
    );
    expect(patch.edges).toContainEqual({
      type: "references",
      from: "doc.dd.f-01",
      to: "doc.bd.api-auth",
    });
  });

  it("resolves hyphenated api filenames and screen slugs", () => {
    const patch = detailDesignDetailFileToPatch(
      "docs/detail-design/en/features/f-02-coupon.md",
      `**Feature Name:** Coupon

See [merchandise-coupon.md](../../basic-design/en/api/merchandise-coupon.md)
and [SCR_00_login.md](../../basic-design/en/screens/SCR_00_login.md)
`,
    );
    expect(patch.edges).toContainEqual({
      type: "references",
      from: "doc.dd.f-02",
      to: "doc.bd.api-merchandise-coupon",
    });
    expect(patch.edges).toContainEqual({
      type: "references",
      from: "doc.dd.f-02",
      to: "doc.bd.screen-scr-00-login",
    });
  });

  it("resolves arbitrary basic-design subfolder links", () => {
    const patch = detailDesignDetailFileToPatch(
      "docs/detail-design/en/features/f-03-webhooks.md",
      `**Feature Name:** Webhooks

See [webhooks.md](../../basic-design/en/integration/webhooks.md)
`,
    );
    expect(documentIdForBasicDesignFile("docs/basic-design/en/integration/webhooks.md")).toBe(
      "doc.bd.doc-en-integration-webhooks",
    );
    expect(patch.edges).toContainEqual({
      type: "references",
      from: "doc.dd.f-03",
      to: "doc.bd.doc-en-integration-webhooks",
    });
  });

  it("resolves srs and detail-design cross-links", () => {
    const patch = detailDesignDetailFileToPatch(
      "docs/detail-design/en/features/f-04-checkout.md",
      `**Feature Name:** Checkout

See [UC-01](../../../srs/en/use-cases/uc-01-login.md)
and [onboarding](../../detail-design/en/guides/onboarding.md)
`,
    );
    expect(patch.edges).toContainEqual({
      type: "references",
      from: "doc.dd.f-04",
      to: "doc.srs.uc-UC-01",
    });
    expect(patch.edges).toContainEqual({
      type: "references",
      from: "doc.dd.f-04",
      to: "doc.dd.doc-en-guides-onboarding",
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
