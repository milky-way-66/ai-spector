import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import {
  clientLanguage,
  loadDocflowConfig,
  preferredLanguageCode,
  primaryLanguage,
} from "@/core/config/load.js";
import { runLangSetClient } from "@/core/operations/lang.js";

async function writeConfig(
  root: string,
  body: Record<string, unknown>,
): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
    ...body,
  });
}

describe("loadDocflowConfig clientLanguage", () => {
  it("loads clientLanguage when it matches a configured language", async () => {
    await withTempProject(async (root) => {
      await writeConfig(root, {
        languages: [
          { code: "en", label: "English" },
          { code: "vi", label: "Vietnamese" },
        ],
        clientLanguage: "vi",
      });

      const { config } = await loadDocflowConfig(root);
      expect(config.clientLanguage).toBe("vi");
      expect(clientLanguage(config).code).toBe("vi");
      expect(preferredLanguageCode(config, "client")).toBe("vi");
      expect(preferredLanguageCode(config, "internal")).toBe("en");
    });
  });

  it("ignores clientLanguage when it is not in languages[]", async () => {
    await withTempProject(async (root) => {
      await writeConfig(root, {
        languages: [{ code: "en", label: "English" }],
        clientLanguage: "vi",
      });

      const { config } = await loadDocflowConfig(root);
      expect(config.clientLanguage).toBeUndefined();
      expect(clientLanguage(config).code).toBe("en");
    });
  });

  it("falls back to primary when clientLanguage is unset", async () => {
    await withTempProject(async (root) => {
      await writeConfig(root, {
        languages: [
          { code: "en", label: "English" },
          { code: "vi", label: "Vietnamese" },
        ],
      });

      const { config } = await loadDocflowConfig(root);
      expect(clientLanguage(config).code).toBe(primaryLanguage(config).code);
    });
  });
});

describe("runLangSetClient", () => {
  it("persists clientLanguage in docflow.config.json", async () => {
    await withTempProject(async (root) => {
      await writeConfig(root, {
        languages: [
          { code: "en", label: "English" },
          { code: "vi", label: "Vietnamese" },
        ],
      });

      const result = await runLangSetClient("vi", { root });
      expect(result.code).toBe("vi");
      expect(result.previousCode).toBeNull();

      const { config } = await loadDocflowConfig(root);
      expect(config.clientLanguage).toBe("vi");
    });
  });

  it("throws when language is not configured", async () => {
    await withTempProject(async (root) => {
      await writeConfig(root, {
        languages: [{ code: "en", label: "English" }],
      });

      await expect(runLangSetClient("vi", { root })).rejects.toThrow(/not configured/);
    });
  });
});
