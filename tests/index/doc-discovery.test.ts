import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverDocSourceFiles,
  computeIndexSourceHash,
} from "../../src/core/index/docs-build.js";
import { runDocSemanticMerge } from "../../src/core/index/doc-semantics.js";

// Regression for the discovery split between docs-index (per-language loop)
// and docs-semantic-merge (bare root walk): both must see the identical file
// set so state.json hashes match and detail files become graph nodes.
describe("doc source discovery contract", () => {
  let projectRoot: string;

  const write = (rel: string, content: string) => {
    const abs = join(projectRoot, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  };

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "ai-spector-discovery-"));
    // Mixed layout: flat legacy file + per-language breakout subdirs.
    write("docs/srs/overview.md", "# Overview\n");
    write(
      "docs/srs/en/03-use-cases/uc-01-login.md",
      "# Use Case Detail\n\n**Use Case ID**: UC-01\n\n# UC-01: Login\n",
    );
    write("docs/basic-design/en/list-screens.md", "# Screen List\n");
    write(
      "docs/basic-design/en/screens/login.md",
      "## 1. Screen: Login\n\n**Feature ID**: F-01\n",
    );
    write(
      "docs/basic-design/en/api/auth-sso.md",
      "# API Detail: Auth SSO\n\n**Feature ID**: F-01\n",
    );
    write(
      ".ai-spector/.docflow/config/index.docs.json",
      JSON.stringify({
        version: 1,
        outputs: {
          srs: ".ai-spector/index/srs.md",
          basicDesign: ".ai-spector/index/basic-design.md",
        },
        sources: {
          srs: { root: "docs/srs", glob: "**/*.md" },
          basicDesign: { root: "docs/basic-design", glob: "**/*.md" },
        },
      }),
    );
    write(
      ".ai-spector/graph/traceability.graph.json",
      JSON.stringify({ version: 1, nodes: [], edges: [] }),
    );
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("walks the bare source root recursively across lang folders and breakout subdirs", async () => {
    const files = await discoverDocSourceFiles(projectRoot, {
      root: "docs/basic-design",
    });
    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("docs/basic-design/en/list-screens.md");
    expect(paths).toContain("docs/basic-design/en/screens/login.md");
    expect(paths).toContain("docs/basic-design/en/api/auth-sso.md");

    const srs = await discoverDocSourceFiles(projectRoot, { root: "docs/srs" });
    const srsPaths = srs.map((f) => f.relativePath);
    expect(srsPaths).toContain("docs/srs/overview.md");
    expect(srsPaths).toContain("docs/srs/en/03-use-cases/uc-01-login.md");
  });

  it("semantic merge ingests detail files and records hashes over the full set", async () => {
    const graphPath = join(projectRoot, ".ai-spector/graph/traceability.graph.json");
    const result = await runDocSemanticMerge({ projectRoot, graphPath });
    expect(result.merged).toBe(true);

    // Hashes must equal a hash over the same recursive walk docs-index uses.
    for (const key of ["srs", "basicDesign"] as const) {
      const files = await discoverDocSourceFiles(projectRoot, {
        root: key === "srs" ? "docs/srs" : "docs/basic-design",
      });
      expect(result.sourceHashes[key]).toBe(computeIndexSourceHash(files));
    }

    const graph = (await import("node:fs/promises").then((fs) =>
      fs.readFile(graphPath, "utf8"),
    )) as string;
    const parsed = JSON.parse(graph) as { nodes: Array<{ id: string }> };
    const ids = parsed.nodes.map((n) => n.id);
    expect(ids).toContain("doc.bd.screen-login");
    expect(ids).toContain("doc.bd.api-auth-sso");
    expect(ids).toContain("doc.srs.uc-UC-01");
  });
});
