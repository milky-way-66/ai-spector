import { describe, expect, it } from "vitest";
import {
  allRegistrySections,
  findRegistrySection,
  parseSectionRegistry,
  sectionLabel,
} from "@/core/graph/registry.js";

const registryJson = {
  version: 1,
  root: "templates",
  documents: [
    {
      documentId: "doc.srs.en",
      template: "srs/01-overview.md",
      output: "docs/srs/en/01-overview.md",
      sections: [
        { id: "sec.srs.en.01", heading: "1. Overview", level: 1 },
        { id: "sec.srs.en.02", heading: "2. Actors", level: 1 },
      ],
    },
  ],
};

describe("registry", () => {
  it("parseSectionRegistry loads documents", () => {
    const reg = parseSectionRegistry(registryJson);
    expect(reg.documents).toHaveLength(1);
    expect(reg.documents[0].documentId).toBe("doc.srs.en");
  });

  it("sectionLabel returns heading", () => {
    const reg = parseSectionRegistry(registryJson);
    expect(sectionLabel(reg, "sec.srs.en.02")).toBe("2. Actors");
    expect(sectionLabel(reg, "missing")).toBeUndefined();
  });

  it("findRegistrySection returns document + section", () => {
    const reg = parseSectionRegistry(registryJson);
    const hit = findRegistrySection(reg, "sec.srs.en.01");
    expect(hit?.document.documentId).toBe("doc.srs.en");
    expect(hit?.section.heading).toBe("1. Overview");
  });

  it("allRegistrySections flattens sections", () => {
    const reg = parseSectionRegistry(registryJson);
    expect(allRegistrySections(reg)).toHaveLength(2);
  });
});
