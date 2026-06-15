import { describe, expect, it } from "vitest";
import { APPROVE_TOOL_DESCRIPTIONS } from "@/interfaces/mcp/tool-descriptions.js";

const APPROVE_TOOL_NAMES = [
  "review_approve",
  "spec_approve",
  "task_approve_plan",
  "comments_resolve",
] as const;

describe("MCP approve tool descriptions", () => {
  for (const tool of APPROVE_TOOL_NAMES) {
    it(`${tool} documents WHEN / NOT WHEN and sibling tools`, () => {
      const desc = APPROVE_TOOL_DESCRIPTIONS[tool];
      expect(desc).toMatch(/WHEN:/i);
      expect(desc).toMatch(/NOT WHEN:/i);

      const siblings = APPROVE_TOOL_NAMES.filter((name) => name !== tool);
      for (const sibling of siblings) {
        expect(desc).toContain(sibling);
      }
    });
  }

  it("review_approve names spec_approve for SPEC-NNN routing", () => {
    expect(APPROVE_TOOL_DESCRIPTIONS.review_approve).toMatch(/SPEC-NNN/i);
    expect(APPROVE_TOOL_DESCRIPTIONS.spec_approve).toMatch(/SPEC-001/i);
  });
});
