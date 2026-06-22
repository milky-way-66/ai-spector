import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJson, readJson } from "@/core/util/fs.js";
import { migrateDocopsLayout } from "@/core/docops/migrate.js";
import { DOCOPS_CONFIG_REL } from "@/core/docops/paths.js";
import { withTempDir } from "../helpers/temp-project.js";

async function writeLegacyFixture(root: string): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: [
      { code: "en", label: "English" },
      { code: "vi", label: "Vietnamese" },
    ],
    primaryLanguage: "en",
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
    packs: { srs: "builtin", basicDesign: "builtin" },
  });

  await writeJson(join(root, "comments/srs/01-overview/thread-1/meta_data.json"), {
    threadId: "thread-1",
    filePath: "srs/01-overview",
    status: "open",
    version: 1,
    anchor: { startLine: 1, endLine: 1 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  await writeJson(join(root, ".ai-spector/review.config.json"), {
    preset: "standard",
    overrides: {},
  });

  await writeJson(join(root, ".ai-spector/.docflow/review-queue/registry.json"), {
    version: 3,
    documents: {},
  });

  await writeJson(join(root, "prototype/screen-map.json"), {
    schemaVersion: 1,
    screens: [],
  });

  await writeJson(join(root, "docs/srs/en/.gitkeep"), {});
}

describe("docops migrate", () => {
  it("creates docops.config.json with primaryLanguage from legacy docflow", async () => {
    await withTempDir(async (root) => {
      await writeLegacyFixture(root);

      const result = await migrateDocopsLayout({ projectRoot: root });
      expect(result.migrated).toBe(true);
      expect(result.config?.primaryLanguage).toBe("en");

      const onDisk = await readJson<{ primaryLanguage?: string }>(
        join(root, DOCOPS_CONFIG_REL),
      );
      expect(onDisk.primaryLanguage).toBe("en");
    });
  });

  it("dry-run does not write docops.config.json", async () => {
    await withTempDir(async (root) => {
      await writeLegacyFixture(root);

      const result = await migrateDocopsLayout({ projectRoot: root, dryRun: true });
      expect(result.migrated).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.actions.some((a) => a.includes("would write"))).toBe(true);

      const { pathExists } = await import("@/core/util/fs.js");
      expect(await pathExists(join(root, DOCOPS_CONFIG_REL))).toBe(false);
    });
  });
});
