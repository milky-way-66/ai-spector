import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempDir } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import {
  mergeDocopsDefaults,
  readDocopsConfig,
  writeDocopsConfig,
} from "@/core/docops/config.js";
import { DOCOPS_CONFIG_REL } from "@/core/docops/paths.js";

describe("docops config", () => {
  it("round-trips minimal config with defaults", async () => {
    await withTempDir(async (root) => {
      const written = await writeDocopsConfig(root, {
        schemaVersion: "1.0",
        languages: [{ code: "en", label: "English" }],
      });

      expect(written).toBe(join(root, DOCOPS_CONFIG_REL));
      const loaded = await readDocopsConfig(root);
      expect(loaded).not.toBeNull();
      expect(loaded?.primaryLanguage).toBe("en");
      expect(loaded?.paths.comments).toBe(".docops/comments");
      expect(loaded?.capabilities.review).toBe(true);
      expect(loaded?.capabilities.graph).toBe(false);
    });
  });

  it("mergeDocopsDefaults fills primaryLanguage from languages", () => {
    const merged = mergeDocopsDefaults({
      languages: [
        { code: "vi", label: "Vietnamese" },
        { code: "en", label: "English" },
      ],
      primaryLanguage: "en",
    });
    expect(merged.primaryLanguage).toBe("en");
    expect(merged.internalLanguage).toBeUndefined();
  });

  it("loadOrDeriveDocopsConfig reads existing docops.config.json", async () => {
    await withTempDir(async (root) => {
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [{ code: "en", label: "English" }],
        paths: {},
      });
      await writeJson(join(root, DOCOPS_CONFIG_REL), {
        schemaVersion: "1.0",
        languages: [
          { code: "en", label: "English" },
          { code: "jp", label: "Japanese" },
        ],
        primaryLanguage: "jp",
      });

      const { loadOrDeriveDocopsConfig } = await import("@/core/docops/config.js");
      const config = await loadOrDeriveDocopsConfig(root);
      expect(config.primaryLanguage).toBe("jp");
    });
  });
});
