import { describe, expect, it } from "vitest";
import { mergeTailoringProfile } from "../../src/core/readiness/profiles.js";
import type { ReadinessCriteriaFile, TailoringProfile } from "../../src/core/readiness/types.js";

const base: ReadinessCriteriaFile = {
  docType: "srs",
  globalCriteria: [
    { id: "G-012", severity: "should-ask", question: "Verification method?" },
    { id: "G-001", severity: "blocking", question: "Purpose?" },
  ],
  targets: [
    {
      dagNode: "srs.introduction",
      criteria: [{ id: "§1-001", severity: "blocking", question: "Audience?" }],
    },
  ],
};

describe("mergeTailoringProfile", () => {
  it("returns general when profile is null", () => {
    const merged = mergeTailoringProfile(base, null);
    expect(merged.appliedProfiles).toEqual(["general"]);
    expect(merged.globalCriteria).toHaveLength(2);
  });

  it("regulated bumps severity and adds criteria", () => {
    const regulated: TailoringProfile = {
      id: "regulated",
      title: "Regulated",
      extends: "srs",
      bumpSeverity: { "G-012": "blocking" },
      addGlobalCriteria: [
        { id: "REG-001", severity: "blocking", question: "Safety class?" },
      ],
    };
    const merged = mergeTailoringProfile(base, regulated);
    expect(merged.globalCriteria.find((c) => c.id === "G-012")?.severity).toBe("blocking");
    expect(merged.globalCriteria.some((c) => c.id === "REG-001")).toBe(true);
    expect(merged.appliedProfiles).toEqual(["regulated"]);
  });

  it("arc42 replaceBase uses profile criteria only", () => {
    const arc42: TailoringProfile = {
      id: "arc42",
      title: "arc42",
      replaceBase: true,
      docType: "arc42",
      globalCriteria: [{ id: "A42-G-001", severity: "blocking", question: "System purpose?" }],
      targets: [],
    };
    const merged = mergeTailoringProfile(base, arc42);
    expect(merged.docType).toBe("arc42");
    expect(merged.globalCriteria).toHaveLength(1);
    expect(merged.globalCriteria[0]!.id).toBe("A42-G-001");
  });
});
