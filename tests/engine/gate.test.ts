import { describe, expect, it } from "vitest";
import { CapabilityDisabledError, isCapabilityEnabled, requireCapability } from "../../src/core/engine/gate.js";
import type { DocopsConfig } from "../../src/core/docops/types.js";

const base: DocopsConfig = {
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
  capabilities: { review: true, comments: true, prototype: false, graph: false, generate: false, translate: false },
};

describe("isCapabilityEnabled", () => {
  it("returns true for enabled capability", () => {
    expect(isCapabilityEnabled(base, "review")).toBe(true);
  });
  it("returns false for disabled capability", () => {
    expect(isCapabilityEnabled(base, "graph")).toBe(false);
  });
});

describe("requireCapability", () => {
  it("throws CapabilityDisabledError when off", () => {
    expect(() => requireCapability(base, "graph")).toThrow(CapabilityDisabledError);
  });
});
