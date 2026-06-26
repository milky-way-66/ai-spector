import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadDocflowConfig, findProjectRoot } from "../../src/core/config/load.js";
import { resolveProjectPaths } from "../../src/core/util/paths.js";

describe("loadDocflowConfig from docops+engine", () => {
  it("synthesizes DocflowConfig when only docops and engine exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "ctx-"));
    await mkdir(join(root, ".docops"), { recursive: true });
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".docops/docops.config.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        docsRoot: "docs",
        languages: [{ code: "en", label: "English" }],
        primaryLanguage: "en",
        paths: {
          comments: ".docops/comments",
          reviewConfig: ".docops/review.config.json",
          reviewQueue: ".docops/review-queue",
          prototypeConfig: ".docops/prototype/config.json",
          prototypeScreenMap: ".docops/prototype/screen-map.json",
        },
        capabilities: {
          review: true,
          comments: true,
          prototype: true,
          graph: true,
          generate: true,
          translate: false,
        },
      }),
      "utf8",
    );
    await writeFile(
      join(root, ".ai-spector/engine.json"),
      JSON.stringify({
        schemaVersion: 1,
        scaffoldVersion: "0.9.0",
        artifacts: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
        },
        readiness: { profile: "general" },
      }),
      "utf8",
    );

    const found = findProjectRoot(root);
    expect(found).toBe(root);

    const { config } = await loadDocflowConfig(root);
    expect(config.scaffoldVersion).toBe("0.9.0");
    expect(config.paths.graph).toBe(".ai-spector/graph/traceability.graph.json");
    expect(config.languages[0].code).toBe("en");
    expect(config.packs.srs).toBe("builtin");
    expect(config.packs.basicDesign).toBe("builtin");

    const paths = await resolveProjectPaths(root);
    expect(paths.graph).toContain("traceability.graph.json");
  });

  it("uses legacy docflow.config.json when present", async () => {
    const root = await mkdtemp(join(tmpdir(), "ctx-legacy-"));
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      JSON.stringify({
        version: 1,
        languages: [{ code: "jp", label: "Japanese" }],
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
        },
        packs: { srs: "builtin", basicDesign: "builtin" },
      }),
      "utf8",
    );

    const { config, configFile } = await loadDocflowConfig(root);
    expect(config.languages[0].code).toBe("jp");
    expect(configFile).toContain("docflow.config.json");
  });

  it("configFile points to engine.json when synthesized", async () => {
    const root = await mkdtemp(join(tmpdir(), "ctx-engine-"));
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/engine.json"),
      JSON.stringify({ schemaVersion: 1, scaffoldVersion: "0.9.0", readiness: { profile: "general" } }),
      "utf8",
    );

    const { configFile } = await loadDocflowConfig(root);
    expect(configFile).toContain("engine.json");
  });

  it("uses docType templatesPath when enabled docType exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "ctx-doctypes-"));
    await mkdir(join(root, ".docops"), { recursive: true });
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".docops/docops.config.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        docsRoot: "docs",
        languages: [{ code: "en", label: "English" }],
        docTypes: {
          srs: { enabled: true, path: "srs", label: "SRS", templatesPath: ".docops/templates/srs" },
        },
        paths: {
          comments: ".docops/comments",
          reviewConfig: ".docops/review.config.json",
          reviewQueue: ".docops/review-queue",
          prototypeConfig: ".docops/prototype/config.json",
          prototypeScreenMap: ".docops/prototype/screen-map.json",
        },
        capabilities: { review: true, comments: true, prototype: true, graph: false, generate: false, translate: false },
      }),
      "utf8",
    );
    await writeFile(
      join(root, ".ai-spector/engine.json"),
      JSON.stringify({ schemaVersion: 1, readiness: { profile: "general" } }),
      "utf8",
    );

    const { config } = await loadDocflowConfig(root);
    expect(config.paths.templates).toBe(".docops/templates/srs");
  });
});
