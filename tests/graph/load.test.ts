import { describe, expect, it } from "vitest";
import { emptyGraph } from "@/core/graph/load.js";

describe("emptyGraph", () => {
  it("returns a version-1 graph with empty nodes and edges", () => {
    expect(emptyGraph()).toEqual({ version: 1, nodes: [], edges: [] });
  });
});
