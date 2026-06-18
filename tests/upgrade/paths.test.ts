import { describe, expect, it } from "vitest";
import { upgradeArtifactPaths } from "@/core/upgrade/paths.js";

describe("upgradeArtifactPaths", () => {
  it("returns paths under .ai-spector/.docflow/upgrade/", () => {
    const p = upgradeArtifactPaths("/proj");
    expect(p.dir).toBe("/proj/.ai-spector/.docflow/upgrade");
    expect(p.scanResult).toBe("/proj/.ai-spector/.docflow/upgrade/scan-result.json");
    expect(p.setup).toBe("/proj/.ai-spector/.docflow/upgrade/upgrade-setup.json");
  });
});
