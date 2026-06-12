import { describe, expect, it } from "vitest";
import { computeLineDiff } from "@/core/lang/diff.js";

describe("computeLineDiff", () => {
  it("formats removals and additions with line numbers", () => {
    const oldText = "line one\nline two\nline three";
    const newText = "line one\nline TWO\nline three\nline four";

    const result = computeLineDiff(oldText, newText);

    expect(result.linesRemoved).toBe(1);
    expect(result.linesAdded).toBe(2);
    expect(result.diff).toContain("2 - line two");
    expect(result.diff).toContain("2 + line TWO");
    expect(result.diff).toContain("4 + line four");
  });

  it("treats missing baseline as full-file addition", () => {
    const result = computeLineDiff(undefined, "alpha\nbeta");

    expect(result.linesRemoved).toBe(0);
    expect(result.linesAdded).toBe(2);
    expect(result.diff).toBe("1 + alpha\n2 + beta");
  });
});
