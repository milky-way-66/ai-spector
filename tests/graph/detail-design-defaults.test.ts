import { describe, expect, it } from "vitest";
import {
  DEFAULT_DD_LIST_DOC,
  DETAIL_DESIGN_LIST_DOCUMENT_IDS,
  PER_DOMAIN_TEMPLATE_DOC_DD,
} from "@/core/graph/defaults.js";

describe("detail design defaults", () => {
  it("exports list and template doc ids", () => {
    expect(DEFAULT_DD_LIST_DOC.featureList).toBe("doc.dd.feature-list");
    expect(PER_DOMAIN_TEMPLATE_DOC_DD.feature).toBe("doc.dd.detail-feature");
    expect(DETAIL_DESIGN_LIST_DOCUMENT_IDS.has("doc.dd.feature-list")).toBe(true);
  });
});
