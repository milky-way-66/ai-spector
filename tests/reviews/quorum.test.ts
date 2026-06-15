import { describe, expect, it } from "vitest";
import { computeQuorum, requiredApprovals } from "@/core/reviews/quorum.js";
import type { ReviewVote } from "@/core/reviews/types.js";

function vote(decision: "approve" | "decline", by: string): ReviewVote {
  return {
    by,
    role: "user",
    decision,
    at: "2026-06-15T10:00:00.000Z",
  };
}

describe("requiredApprovals", () => {
  it("returns 0 for no voters", () => {
    expect(requiredApprovals(0)).toBe(0);
  });

  it("requires 1 approval for 1 voter", () => {
    expect(requiredApprovals(1)).toBe(1);
  });

  it("requires 2 approvals for 2 or 3 voters", () => {
    expect(requiredApprovals(2)).toBe(2);
    expect(requiredApprovals(3)).toBe(2);
  });
});

describe("computeQuorum", () => {
  it("met with single approve", () => {
    expect(computeQuorum([vote("approve", "a")])).toMatchObject({
      voterCount: 1,
      approveCount: 1,
      required: 1,
      met: true,
    });
  });

  it("met with 2 approve and 1 decline", () => {
    expect(
      computeQuorum([vote("approve", "a"), vote("approve", "b"), vote("decline", "c")]),
    ).toMatchObject({
      voterCount: 3,
      approveCount: 2,
      required: 2,
      met: true,
    });
  });

  it("pending with 1 approve and 1 decline", () => {
    expect(computeQuorum([vote("approve", "a"), vote("decline", "b")])).toMatchObject({
      voterCount: 2,
      approveCount: 1,
      required: 2,
      met: false,
    });
  });
});
