import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runUpgradeScan } from "@/core/upgrade/scan.js";

const FIXTURE = join(import.meta.dirname, "../fixtures/upgrade-stale-scaffold");

describe("runUpgradeScan", () => {
  it("detects applicable items for stale scaffold", async () => {
    const result = await runUpgradeScan({
      root: FIXTURE,
      toVersion: "0.8.85",
    });
    expect(result.fromVersion).toBe("0.4.0");
    expect(result.applicableItems).toContain("UPG-010");
    expect(result.ready).toBe(false);
  });

  it("rejects downgrade", async () => {
    await expect(runUpgradeScan({ root: FIXTURE, toVersion: "0.1.0" })).rejects.toThrow(
      /downgrade/i,
    );
  });

  it("returns ready when already on latest version", async () => {
    const result = await runUpgradeScan({
      root: FIXTURE,
      toVersion: "0.4.0",
    });
    expect(result.fromVersion).toBe("0.4.0");
    expect(result.toVersion).toBe("0.4.0");
    expect(result.alreadyCurrent).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
