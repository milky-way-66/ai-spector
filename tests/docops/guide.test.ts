import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJson } from "@/core/util/fs.js";
import { buildDocopsMigrateGuide } from "@/core/docops/guide.js";
import { DOCOPS_CONFIG_REL } from "@/core/docops/paths.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("docops guide", () => {
  it("flags blocker when docops config exists but repair is needed", async () => {
    await withTempDir(async (root) => {
      await writeJson(join(root, ".docops/docops.config.json"), {
        schemaVersion: "1.0",
        docsRoot: "docs",
        languages: [{ code: "en", label: "English", path: "en" }],
        primaryLanguage: "en",
        docTypes: {
          srs: {
            enabled: true,
            path: "srs",
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
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await writeFile(join(root, "docs/srs/en/01-overview.md"), "# Overview\n", "utf8");

      const guide = await buildDocopsMigrateGuide(root);
      expect(guide.writerReady).toBe(false);
      expect(guide.recommendedAction).toBe("repair");
      expect(guide.cli.primaryCommand).toContain("migrate --repair");
      expect(guide.targetState.docTypes.srs?.path).toBe("docs/srs");
      expect(guide.targetState.examples.wrongVsCorrect.some((r) => r.field === "docTypes.srs.path")).toBe(true);
      expect(guide.targetState.examples.docopsConfig.docTypes).toBeTruthy();
      expect(guide.targetState.examples.documentPaths).toContain("docs/srs/en/01-overview.md");
      expect(guide.agentTasks.some((t) => t.id.startsWith("DOCOPS-PATH"))).toBe(true);
      expect(guide.agentPrompt).toContain("Wrong vs correct");
      expect(guide.agentPrompt).toContain("Example .docops/docops.config.json");
      expect(guide.agentPrompt).toContain("do not move");
      expect(guide.agentPrompt).toContain("Bundled in ai-spector CLI");
      expect(guide.targetState.examples.bundle.bootstrapRoot).toMatch(/contracts\/bootstrap$/);
      expect(guide.currentState.missingScaffold.length).toBeGreaterThan(0);
      expect(guide.agentPrompt).toContain("Current state");
      expect(guide.agentPrompt).toContain("Expected");
      expect(guide.agentPrompt).toContain(DOCOPS_CONFIG_REL);
    });
  });

  it("recommends migrate when only legacy docflow exists", async () => {
    await withTempDir(async (root) => {
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [{ code: "en", label: "English" }],
        packs: { srs: "builtin", basicDesign: "builtin" },
      });
      await mkdir(join(root, "docs/srs/en"), { recursive: true });

      const guide = await buildDocopsMigrateGuide(root);
      expect(guide.layout).toBe("legacy");
      expect(guide.recommendedAction).toBe("migrate");
      expect(guide.cli.primaryCommand).toBe("npx ai-spector docops migrate");
      expect(guide.targetState.examples.docopsConfig).toBeTruthy();
      expect(guide.targetState.examples.wrongVsCorrect.some((r) => r.field === DOCOPS_CONFIG_REL)).toBe(true);
      expect(guide.agentPrompt).toContain("Example .docops/docops.config.json");
      expect(guide.agentPrompt).toContain("Tasks (in order)");
    });
  });

  it("includes mixed-layout blocker when legacy and docops coexist", async () => {
    await withTempDir(async (root) => {
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [{ code: "en", label: "English" }],
      });
      await writeJson(join(root, ".docops/docops.config.json"), {
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
      await mkdir(join(root, "docs/srs/en"), { recursive: true });

      const guide = await buildDocopsMigrateGuide(root);
      expect(guide.layout).toBe("mixed");
      expect(guide.cli.blockers.some((b) => b.includes("Mixed legacy"))).toBe(true);
    });
  });
});
