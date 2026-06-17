import { describe, expect, it } from "vitest";
import { generateSlotFromDocPath } from "@/core/operations/task-templates.js";

describe("generateSlotFromDocPath detail design", () => {
  it("maps docs/detail-design paths to generate:detail-design slot", () => {
    expect(
      generateSlotFromDocPath("docs/detail-design/en/features/f-01-checkout.md"),
    ).toBe("generate:detail-design");
    expect(
      generateSlotFromDocPath("docs/detail-design/en/common/architecture-overview.md"),
    ).toBe("generate:detail-design");
    expect(generateSlotFromDocPath("docs/detail-design/en/feature-list.md")).toBe(
      "generate:detail-design",
    );
  });
});
