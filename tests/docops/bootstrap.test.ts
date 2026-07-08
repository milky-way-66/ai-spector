import { describe, expect, it } from "vitest";
import { listBootstrapDocDestinations, resolveBootstrapRoot } from "@/core/docops/bootstrap.js";

describe("docops bootstrap bundle", () => {
  it("resolves packaged bootstrap root with README", () => {
    const root = resolveBootstrapRoot();
    expect(root).toMatch(/contracts\/bootstrap$/);
    const dests = listBootstrapDocDestinations(root);
    expect(dests).toContain(".docops/guide/README.md");
    expect(dests).toContain(".docops/guide/guides/DOCOPS_MANUAL_FALLBACK.md");
  });

  it("ships schemas and examples in ai-spector contracts", async () => {
    const { packagedContractsRoot } = await import("@/core/docops/bootstrap.js");
    const { pathExists } = await import("@/core/util/fs.js");
    const contracts = packagedContractsRoot();
    expect(await pathExists(`${contracts}/schemas/docops.config.schema.json`)).toBe(true);
    expect(await pathExists(`${contracts}/examples/full-docops.config.json`)).toBe(true);
  });
});
