import { describe, expect, it } from "vitest";
import {
  buildPreviewUri,
  routePatternHasUnresolvedParams,
} from "../../src/prototype/preview-uri.js";

describe("buildPreviewUri", () => {
  it("substitutes path params and appends query", () => {
    expect(
      buildPreviewUri("/orders/:id", { id: "ORD-001" }, { tab: "summary" }),
    ).toBe("/orders/ORD-001?tab=summary");
  });

  it("returns slug route when no params", () => {
    expect(buildPreviewUri("/dashboard")).toBe("/dashboard");
  });
});

describe("routePatternHasUnresolvedParams", () => {
  it("detects missing param values", () => {
    expect(routePatternHasUnresolvedParams("/orders/:id")).toBe(true);
    expect(routePatternHasUnresolvedParams("/orders/:id", { id: "1" })).toBe(false);
  });
});
