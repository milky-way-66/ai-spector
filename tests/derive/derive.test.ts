import { describe, expect, it } from "vitest";
import {
  validateDeriveBootstrap,
  type DeriveBootstrapInput,
} from "@/core/operations/derive.js";

describe("validateDeriveBootstrap", () => {
  it("rejects derive-downstream without deriveFrom", () => {
    const input: DeriveBootstrapInput = {
      sourceMode: "derive-downstream",
      workflow: "generate-srs",
    };
    expect(() => validateDeriveBootstrap(input)).toThrow(/deriveFrom/);
  });

  it("accepts forward mode without deriveFrom", () => {
    expect(
      validateDeriveBootstrap({ sourceMode: "forward", workflow: "generate-srs" }),
    ).toEqual({ sourceMode: "forward", derivePhase: "extract" });
  });

  it("defaults derivePhase to extract", () => {
    const result = validateDeriveBootstrap({
      sourceMode: "derive-downstream",
      workflow: "generate-srs",
      deriveFrom: ["basic-design", "detail-design"],
    });
    expect(result.derivePhase).toBe("extract");
  });

  it("rejects expand without priorDeriveTaskId when no active extract task", () => {
    expect(() =>
      validateDeriveBootstrap({
        sourceMode: "derive-downstream",
        workflow: "generate-srs",
        deriveFrom: ["basic-design"],
        derivePhase: "expand",
      }),
    ).toThrow(/priorDeriveTaskId|completed extract/);
  });
});
