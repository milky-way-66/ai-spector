import { describe, expect, it } from "vitest";
import {
  listReadinessProfiles,
  loadTailoringProfile,
  mergeTailoringProfile,
} from "../../src/core/readiness/profiles.js";
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

describe("readiness profiles bundle", () => {
  it("lists general as a file-backed profile marked default", async () => {
    const profiles = await listReadinessProfiles();
    const general = profiles.find((p) => p.id === "general");
    expect(general).toBeDefined();
    expect(general?.default).toBe(true);
    expect(profiles[0]?.id).toBe("general");
  });

  it("loads general profile from readiness/profiles/general.json", async () => {
    const general = await loadTailoringProfile("general");
    expect(general?.id).toBe("general");
    expect(general?.extends).toBe("srs");
  });
});

describe("mergeTailoringProfile", () => {
  it("returns general when profile is null", () => {
    const merged = mergeTailoringProfile(base, null);
    expect(merged.appliedProfiles).toEqual(["general"]);
    expect(merged.globalCriteria).toHaveLength(2);
  });

  it("general file profile applies same baseline as null", () => {
    const general: TailoringProfile = {
      id: "general",
      title: "General",
      extends: "srs",
      default: true,
    };
    const merged = mergeTailoringProfile(base, general);
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
