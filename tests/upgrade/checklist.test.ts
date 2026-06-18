import { describe, expect, it } from "vitest";
import { filterApplicableItems, loadUpgradeChecklist } from "@/core/upgrade/checklist.js";

describe("upgrade checklist", () => {
  it("loads items with unique ids", () => {
    const checklist = loadUpgradeChecklist();
    const ids = checklist.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters by semver since", () => {
    const checklist = loadUpgradeChecklist();
    const applicable = filterApplicableItems(checklist.items, {
      fromVersion: "0.5.0",
      toVersion: "0.8.85",
      editors: ["cursor"],
    });
    expect(applicable.some((i) => i.id === "UPG-001")).toBe(true);
    expect(applicable.some((i) => i.id === "UPG-999-fake")).toBe(false);
  });
});
