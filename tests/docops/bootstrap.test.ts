import { describe, expect, it } from "vitest";
import { listBootstrapDocDestinations, resolveBootstrapRoot } from "@/core/docops/bootstrap.js";

describe("docops bootstrap bundle", () => {
  it("resolves bootstrap root with README", () => {
    const root = resolveBootstrapRoot();
    expect(root).toMatch(/contracts\/bootstrap$/);
    const dests = listBootstrapDocDestinations(root);
    expect(dests).toContain(".docops/README.md");
  });
});
