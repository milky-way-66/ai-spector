import { describe, expect, it } from "vitest";
import { DEFAULT_RESOLVED_PLUGINS } from "@/core/docops/capabilities.js";

describe("docops capabilities", () => {
  it("DEFAULT_RESOLVED_PLUGINS includes core plugin ids", () => {
    expect(DEFAULT_RESOLVED_PLUGINS).toContain("comments");
    expect(DEFAULT_RESOLVED_PLUGINS).toContain("review");
    expect(DEFAULT_RESOLVED_PLUGINS).toContain("graph");
    expect(DEFAULT_RESOLVED_PLUGINS).toContain("generate-srs");
  });
});
