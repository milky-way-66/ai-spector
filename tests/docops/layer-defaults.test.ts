import { describe, expect, it } from "vitest";
import {
  buildDocTypesFromLayers,
  ensureOptionalDocTypes,
  templateLayerKeys,
} from "@/core/docops/layer-defaults.js";

describe("docops layer defaults", () => {
  it("includes disabled detailDesign and otherDocument when not selected", () => {
    const docTypes = buildDocTypesFromLayers(["srs", "basicDesign"], {});
    expect(docTypes.srs?.enabled).toBe(true);
    expect(docTypes.basicDesign?.enabled).toBe(true);
    expect(docTypes.detailDesign).toEqual({
      enabled: false,
      path: "docs/detail-design",
      label: "Detail Design",
      templatesPath: ".docops/templates/detail-design",
    });
    expect(docTypes.otherDocument).toEqual({
      enabled: false,
      path: "docs/other",
      label: "Other Document",
    });
  });

  it("ensureOptionalDocTypes adds missing optional layers", () => {
    const next = ensureOptionalDocTypes({
      srs: {
        enabled: true,
        path: "docs/srs",
        label: "SRS",
        templatesPath: ".docops/templates/srs",
      },
    });
    expect(next.detailDesign?.enabled).toBe(false);
    expect(next.otherDocument?.enabled).toBe(false);
  });

  it("templateLayerKeys includes detailDesign when disabled", () => {
    const keys = templateLayerKeys({
      docTypes: {
        srs: {
          enabled: true,
          path: "docs/srs",
          label: "SRS",
          templatesPath: ".docops/templates/srs",
        },
        detailDesign: {
          enabled: false,
          path: "docs/detail-design",
          label: "Detail Design",
          templatesPath: ".docops/templates/detail-design",
        },
      },
    });
    expect(keys).toContain("srs");
    expect(keys).toContain("detailDesign");
    expect(keys).not.toContain("otherDocument");
  });
});
