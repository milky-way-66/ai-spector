import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanConfigDrift, scanConfigSchema } from "@/core/upgrade/detectors.js";
import { withTempDir } from "../helpers/temp-project.js";

async function writeLegacyConfig(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({
      version: 1,
      languages: [{ code: "en", label: "English" }],
      packs: { srs: "builtin", active: "builtin" },
    }),
    "utf8",
  );
}

describe("upgrade detectors", () => {
  it("flags missing packs.basicDesign", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({
          version: 1,
          languages: [{ code: "en", label: "English" }],
          packs: { srs: "builtin" },
        }),
        "utf8",
      );
      const findings = await scanConfigSchema(root);
      expect(findings.some((f) => f.id.includes("packs.basicDesign"))).toBe(true);
    });
  });

  it("flags deprecated packs.active", async () => {
    await withTempDir(async (root) => {
      await writeLegacyConfig(root);
      const findings = await scanConfigDrift(root);
      expect(findings.some((f) => f.id.includes("packs.active"))).toBe(true);
    });
  });
});
