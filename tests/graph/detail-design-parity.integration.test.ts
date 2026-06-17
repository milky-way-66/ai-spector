import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildDocExtractPatch } from "@/core/graph/doc-extract.js";

describe("detail design parity integration", () => {
  it("builds graph patch from SRS + BD + DD fixture files", async () => {
    const root = await mkdtemp(join(tmpdir(), "dd-parity-"));
    await mkdir(join(root, "docs/srs/en"), { recursive: true });
    await mkdir(join(root, "docs/basic-design/en/api"), { recursive: true });
    await mkdir(join(root, "docs/detail-design/en/common"), { recursive: true });
    await mkdir(join(root, "docs/detail-design/en/features"), { recursive: true });

    const entries = [
      {
        relativePath: "docs/srs/en/4-system-features.md",
        content: `| F-01 | Checkout | UC-01 | High | Draft | [detail](features/f-01-checkout.md) |`,
      },
      {
        relativePath: "docs/basic-design/en/api-list.md",
        content: `# API List\n\n## 3. Endpoint Summary\n`,
      },
      {
        relativePath: "docs/basic-design/en/api/post-checkout.md",
        content: `# API Detail: POST /checkout\n\n**Feature ID:** F-01\n`,
      },
      {
        relativePath: "docs/detail-design/en/common/architecture-overview.md",
        content: `# Architecture Overview\n\n## 1. System Context\n`,
      },
      {
        relativePath: "docs/detail-design/en/feature-list.md",
        content: `# Detail Design: Feature List\n\n## 1. List of Features\n\n| F-01 | Checkout | SRS 4.1 | High | Draft |\n`,
      },
      {
        relativePath: "docs/detail-design/en/features/f-01-checkout.md",
        content: `# Detail Design: Checkout

**Feature Name:** Checkout

See [API](../../basic-design/api/post-checkout.md).

## 1. Feature Implementation Overview
`,
      },
    ];

    const { patch, stats } = await buildDocExtractPatch(entries, root);
    expect(stats.ddDetailDocuments).toBeGreaterThanOrEqual(1);
    expect(patch.nodes.some((n) => n.id === "doc.dd.f-01")).toBe(true);
    expect(patch.edges.some((e) => e.type === "tracesTo" && e.from === "F-01")).toBe(true);
    expect(patch.nodes.some((n) => n.id === "doc.bd.api-post-checkout")).toBe(true);
  });
});
