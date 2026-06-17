import { describe, expect, it } from "vitest";
import { loadDetailDesignListManifest } from "@/core/config/load.js";

describe("loadDetailDesignListManifest", () => {
  it("loads builtin detail design documents", async () => {
    const manifest = await loadDetailDesignListManifest();
    expect(manifest.nodePrefix).toBe("doc.dd");
    expect(manifest.perDomainTemplates?.featureDetail).toBe("doc.dd.detail-feature");
    const ids = manifest.documents.map((d) => d.documentId);
    expect(ids).toContain("doc.dd.feature-list");
    expect(ids).toContain("doc.dd.architecture-overview");
    expect(manifest.documents).toHaveLength(7);
  });
});
