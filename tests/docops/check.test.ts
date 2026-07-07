import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkDocopsConfig } from "@/core/docops/check.js";
import { initDocopsContract } from "@/core/docops/init.js";
import { DOCOPS_CONFIG_REL } from "@/core/docops/paths.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("checkDocopsConfig", () => {
  it("reports missing config with init command", async () => {
    await withTempDir(async (root) => {
      const result = await checkDocopsConfig(root);
      expect(result.valid).toBe(false);
      expect(result.configExists).toBe(false);
      expect(result.recommendedCommand).toMatch(/docops init/);
      expect(result.actions.some((a) => a.id === "DOCOPS-001")).toBe(true);
      expect(result.agentPrompt).toContain("DOCOPS-001");
    });
  });

  it("detects config drift and recommends repair", async () => {
    await withTempDir(async (root) => {
      await writeJson(join(root, DOCOPS_CONFIG_REL), {
        schemaVersion: "1.0",
        docsRoot: "docs",
        languages: [{ code: "en", label: "English", path: "en" }],
        primaryLanguage: "en",
        docTypes: {
          srs: {
            enabled: true,
            path: "docs/srs",
            label: "SRS",
            templatesPath: ".docops/templates/srs",
          },
        },
        paths: {
          comments: ".docops/comments",
          reviewConfig: ".docops/review.config.json",
          reviewQueue: ".docops/review-queue",
          prototypeConfig: ".docops/prototype/config.json",
          prototypeScreenMap: ".docops/prototype/screen-map.json",
        },
        capabilities: { review: false, comments: true, prototype: false },
      });
      await mkdir(join(root, ".docops/templates/srs"), { recursive: true });

      const result = await checkDocopsConfig(root);
      expect(result.configDrift).toBe(true);
      expect(result.driftSummary.some((d) => d.includes("paths.registry"))).toBe(true);
      expect(result.driftSummary.some((d) => d.includes("detailDesign"))).toBe(true);
      expect(result.recommendedCommand).toBe("npx ai-spector docops migrate --repair");
      expect(result.agentPrompt).toContain("npx ai-spector docops migrate --repair");
      expect(result.repairPreview.length).toBeGreaterThan(0);
    });
  });

  it("passes for freshly initialized contract", async () => {
    await withTempDir(async (root) => {
      await initDocopsContract({ projectRoot: root, layers: ["srs", "basicDesign"] });
      const result = await checkDocopsConfig(root);
      expect(result.configExists).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.configDrift).toBe(false);
      expect(result.valid).toBe(true);
      expect(result.actions.filter((a) => a.severity === "blocking")).toHaveLength(0);
    });
  });
});
