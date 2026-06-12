import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copyFile } from "node:fs/promises";
import { packageBundleRoot } from "../../src/core/config/load.js";
import { scanDocumentsForReadiness } from "../../src/core/readiness/scan-docs.js";

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

describe("readiness scan", () => {
  it("flags missing headings and TODO placeholders", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-rscan-"));
    const configDir = join(root, ".ai-spector/.docflow/config");
    await mkdir(configDir, { recursive: true });
    await mkdir(join(root, "docs/srs/en"), { recursive: true });

    const bundle = join(packageBundleRoot(), "scaffold/.ai-spector/.docflow/config");
    await copyFile(join(bundle, "readiness-criteria.srs.json"), join(configDir, "readiness-criteria.srs.json"));
    await copyFile(join(bundle, "completeness-rules.srs.json"), join(configDir, "completeness-rules.srs.json"));

    await writeJson(join(root, ".ai-spector/docflow.config.json"), {
      version: 1,
      languages: [{ code: "en", label: "English" }],
      readiness: { profile: "general" },
      paths: {
        graph: ".ai-spector/graph/traceability.graph.json",
        registry: ".ai-spector/registry/section-registry.json",
      },
      packs: { srs: "builtin", basicDesign: "builtin" },
    });

    await writeFile(
      join(root, "docs/srs/en/1-introduction.md"),
      "# Intro\n\nTODO: fill purpose\n",
      "utf8",
    );

    const result = await scanDocumentsForReadiness({ root, docType: "srs" });
    expect(result.documentsScanned).toBeGreaterThanOrEqual(1);
    expect(result.findings.some((f) => f.id === "COMP-PLACEHOLDER")).toBe(true);
    expect(result.findings.some((f) => f.id === "COMP-HEADING")).toBe(true);
  });

  it("suggests regulated content when profile is regulated", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-rscan-"));
    const configDir = join(root, ".ai-spector/.docflow/config");
    await mkdir(configDir, { recursive: true });
    await mkdir(join(root, "docs/srs/en"), { recursive: true });

    const bundle = join(packageBundleRoot(), "scaffold/.ai-spector/.docflow/config");
    await copyFile(join(bundle, "readiness-criteria.srs.json"), join(configDir, "readiness-criteria.srs.json"));
    await copyFile(join(bundle, "completeness-rules.srs.json"), join(configDir, "completeness-rules.srs.json"));

    await writeJson(join(root, ".ai-spector/docflow.config.json"), {
      version: 1,
      languages: [{ code: "en", label: "English" }],
      readiness: { profile: "regulated" },
      paths: {
        graph: ".ai-spector/graph/traceability.graph.json",
        registry: ".ai-spector/registry/section-registry.json",
      },
      packs: { srs: "builtin", basicDesign: "builtin" },
    });

    await writeFile(
      join(root, "docs/srs/en/1-introduction.md"),
      `## 1. Introduction\n\n### 1.1 Document Purpose\n\nAudience.\n\n### 1.3 Project Scope\n\nScope.\n`,
      "utf8",
    );

    const result = await scanDocumentsForReadiness({ root, docType: "srs", profile: "regulated" });
    expect(result.profile).toBe("regulated");
    expect(result.findings.some((f) => f.id.startsWith("PROFILE-"))).toBe(true);
  });
});
