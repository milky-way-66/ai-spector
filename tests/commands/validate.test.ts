import { describe, expect, it } from "vitest";
import { formatIssues } from "../../src/commands/validate.js";
import type { ValidationIssue } from "../../src/types.js";

describe("formatIssues", () => {
  it("returns OK message when there are no issues", () => {
    expect(formatIssues([])).toBe("OK — no validation issues");
  });

  it("formats errors with rule id and optional node id", () => {
    const issues: ValidationIssue[] = [
      {
        ruleId: "SECTION-TREE",
        severity: "error",
        message: "bad tree",
        nodeId: "sec.x",
      },
    ];

    const text = formatIssues(issues);

    expect(text).toContain("[ERROR] SECTION-TREE: bad tree (sec.x)");
    expect(text).toContain("Fix each ERROR above");
  });
});
