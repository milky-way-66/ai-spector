import { readJson } from "../util/fs.js";
import type { TraceabilityGraph } from "../types.js";
import { InMemoryGraph } from "./InMemoryGraph.js";

export async function loadInMemoryGraph(
  graphPath: string,
): Promise<InMemoryGraph> {
  const data = await readJson<TraceabilityGraph>(graphPath);
  return InMemoryGraph.from(data);
}
