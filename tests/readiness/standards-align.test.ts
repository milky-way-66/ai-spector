import { describe, expect, it } from "vitest";
import { checkStandardsAlignment } from "../../src/core/readiness/standards-align.js";

describe("checkStandardsAlignment", () => {
  it("reports unmatched config tags not in criteria file", () => {
    const result = checkStandardsAlignment(
      ["ISO-29148", "IEC-62304"],
      [{ id: "ISO-29148", title: "29148" }],
    );
    expect(result.configDeclared).toEqual(["ISO-29148", "IEC-62304"]);
    expect(result.criteriaFile).toEqual(["ISO-29148"]);
    expect(result.unmatchedInCriteria).toEqual(["IEC-62304"]);
  });

  it("treats config subset of criteria as aligned", () => {
    const result = checkStandardsAlignment(
      ["ISO-29148"],
      [
        { id: "ISO-29148" },
        { id: "ISO-15288" },
      ],
    );
    expect(result.unmatchedInCriteria).toEqual([]);
  });
});
