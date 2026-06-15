import { describe, expect, it } from "vitest";
import { computeQuorum } from "@/core/reviews/quorum.js";
import type { ReviewVote } from "@/core/reviews/types.js";

function vote(decision: "approve" | "decline", by: string): ReviewVote {
  return {
    by,
    role: "user",
    decision,
    at: "2026-06-15T10:00:00.000Z",
  };
}

describe("computeQuorum with minApprovals", () => {
  it("pending when approve count is below minimum", () => {
    expect(computeQuorum([vote("approve", "a")], 2)).toMatchObject({
      voterCount: 1,
      approveCount: 1,
      required: 2,
      met: false,
    });
  });

  it("met when approve count reaches minimum", () => {
    expect(
      computeQuorum([vote("approve", "a"), vote("approve", "b")], 2),
    ).toMatchObject({
      voterCount: 2,
      approveCount: 2,
      required: 2,
      met: true,
    });
  });

  it("met with 2 approve and 1 decline when min is 2", () => {
    expect(
      computeQuorum(
        [vote("approve", "a"), vote("approve", "b"), vote("decline", "c")],
        2,
      ),
    ).toMatchObject({
      voterCount: 3,
      approveCount: 2,
      required: 2,
      met: true,
    });
  });

  it("pending with 1 approve and 1 decline when min is 2", () => {
    expect(computeQuorum([vote("approve", "a"), vote("decline", "b")], 2)).toMatchObject({
      voterCount: 2,
      approveCount: 1,
      required: 2,
      met: false,
    });
  });

  it("met with single approve when min is 1", () => {
    expect(computeQuorum([vote("approve", "a")], 1)).toMatchObject({
      voterCount: 1,
      approveCount: 1,
      required: 1,
      met: true,
    });
  });
});
