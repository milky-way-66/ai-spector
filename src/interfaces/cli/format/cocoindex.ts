import type {
  CocoindexSetupResult,
  CocoindexSearchResult,
} from "../../../core/operations/cocoindex.js";

export function formatCocoindexSetup(r: CocoindexSetupResult): string {
  if (r.alreadyExists) {
    return [
      "CocoIndex already configured.",
      `  pipeline: ${r.pipelinePath}`,
      "",
      "Run with --force to overwrite.",
    ].join("\n");
  }
  return [
    "CocoIndex pipeline scaffolded.",
    `  pipeline: ${r.pipelinePath}`,
    `  env:      ${r.envPath}`,
    "",
    "Next steps:",
    "  1. cd to the cocoindex directory and copy .env.example → .env",
    "  2. pip install -r requirements.txt",
    "  3. python pipeline.py cocoindex update",
  ].join("\n");
}

export function formatCocoindexSearch(r: CocoindexSearchResult): string {
  if (!r.cocoindexConfigured) {
    return [
      "CocoIndex is not configured for this project.",
      "Run: npx ai-spector cocoindex setup",
    ].join("\n");
  }

  if (r.results.length === 0) {
    return `No results for "${r.query}".`;
  }

  const lines: string[] = [`Results for "${r.query}"`, ""];
  for (const res of r.results) {
    const nodeTag = res.graphNodeId ? `  [${res.graphNodeId}]` : "";
    lines.push(`  ${res.docPath} § ${res.heading}${nodeTag}  (score: ${res.score})`);
    if (res.excerpt) {
      const preview = res.excerpt.slice(0, 120).replace(/\n/g, " ");
      lines.push(`    ${preview}${res.excerpt.length > 120 ? "…" : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
