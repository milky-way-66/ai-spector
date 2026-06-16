import { describe, expect, it } from "vitest";
import { adoptArtifactPaths } from "@/core/adopt/paths.js";

describe("adoptArtifactPaths", () => {
  it("returns paths under .ai-spector/.docflow/adopt/", () => {
    const p = adoptArtifactPaths("/proj");
    expect(p.scanResult).toBe("/proj/.ai-spector/.docflow/adopt/scan-result.json");
    expect(p.plan).toBe("/proj/.ai-spector/.docflow/adopt/plan.json");
    expect(p.setup).toBe("/proj/.ai-spector/.docflow/adopt/adopt-setup.json");
    expect(p.context).toBe("/proj/.ai-spector/.docflow/adopt/context.json");
    expect(p.history).toBe("/proj/.ai-spector/.docflow/adopt/history.jsonl");
  });
});
