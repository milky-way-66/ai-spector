import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packageBundleRoot } from "@/core/config/load.js";
import { loadDocflowConfig } from "@/core/config/load.js";
import { resolveCriteriaFilePath } from "@/core/readiness/criteria-path.js";
import { loadMergedReadinessCriteria } from "@/core/readiness/resolve.js";

async function writeMinimalConfig(root: string) {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    `${JSON.stringify({
      version: 1,
      languages: [{ code: "en", label: "English" }],
      packs: { srs: "builtin", basicDesign: "builtin" },
    })}\n`,
  );
}

describe("basic design readiness", () => {
  it("resolves builtin basic-design criteria path", async () => {
    const root = await mkdtemp(join(tmpdir(), "bd-ready-"));
    await writeMinimalConfig(root);
    const cfgDir = join(root, ".ai-spector/.docflow/config/doc-types/basic-design");
    await mkdir(cfgDir, { recursive: true });
    const src = join(
      packageBundleRoot(),
      "scaffold/.ai-spector/.docflow/config/doc-types/basic-design/readiness-criteria.json",
    );
    await copyFile(src, join(cfgDir, "readiness-criteria.json"));
    const { config } = await loadDocflowConfig(root);
    const resolved = await resolveCriteriaFilePath(root, config, "basic-design");
    expect(resolved.docType).toBe("basic-design");
    expect(resolved.path).toContain("basic-design/readiness-criteria.json");
  });

  it("loads merged criteria with list-api target", async () => {
    const root = await mkdtemp(join(tmpdir(), "bd-ready2-"));
    await writeMinimalConfig(root);
    const cfgDir = join(root, ".ai-spector/.docflow/config/doc-types/basic-design");
    await mkdir(cfgDir, { recursive: true });
    const src = join(
      packageBundleRoot(),
      "scaffold/.ai-spector/.docflow/config/doc-types/basic-design/readiness-criteria.json",
    );
    await copyFile(src, join(cfgDir, "readiness-criteria.json"));
    const merged = await loadMergedReadinessCriteria({ root, docType: "basic-design" });
    expect(merged.docType).toBe("basic-design");
    expect(merged.criteria.targets?.some((t) => t.dagNode === "bd.list-api")).toBe(true);
    expect(merged.criteria.standards?.length).toBeGreaterThan(0);
    expect(merged.criteria.version).toBe(2);
  });
});
